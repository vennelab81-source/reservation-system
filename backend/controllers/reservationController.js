const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const { AppError } = require('../middleware/errorHandler');

const TIME_SLOT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Combines a 'YYYY-MM-DD' date and 'HH:MM' slot into start/end Date objects
const computeWindow = (date, timeSlot, durationMinutes) => {
  const startDateTime = new Date(`${date}T${timeSlot}:00`);
  if (isNaN(startDateTime.getTime())) {
    throw new AppError('Invalid date or time slot', 400);
  }
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
  return { startDateTime, endDateTime };
};

// Core conflict check: does any CONFIRMED reservation on this table
// overlap the requested [startDateTime, endDateTime) window?
// Two intervals overlap iff existing.start < new.end AND existing.end > new.start
const hasConflict = async (tableId, startDateTime, endDateTime, excludeReservationId = null) => {
  const query = {
    table: tableId,
    status: 'confirmed',
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
  };
  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }
  const conflict = await Reservation.findOne(query);
  return conflict;
};

// @route POST /api/reservations (customer)
exports.createReservation = async (req, res, next) => {
  try {
    const { tableId, date, timeSlot, guests, durationMinutes } = req.body;

    if (!tableId || !date || !timeSlot || !guests) {
      throw new AppError('tableId, date, timeSlot and guests are required', 400);
    }
    if (!DATE_REGEX.test(date)) {
      throw new AppError('date must be in YYYY-MM-DD format', 400);
    }
    if (!TIME_SLOT_REGEX.test(timeSlot)) {
      throw new AppError('timeSlot must be in HH:MM (24h) format', 400);
    }
    if (guests < 1) {
      throw new AppError('guests must be at least 1', 400);
    }

    const requestedDate = new Date(`${date}T${timeSlot}:00`);
    if (requestedDate.getTime() < Date.now()) {
      throw new AppError('Cannot create a reservation in the past', 400);
    }

    const table = await Table.findById(tableId);
    if (!table || !table.isActive) {
      throw new AppError('Table not found', 404);
    }
    if (guests > table.capacity) {
      throw new AppError(
        `Table ${table.tableNumber} seats up to ${table.capacity} guests; ${guests} requested`,
        400
      );
    }

    const duration = durationMinutes || 90;
    const { startDateTime, endDateTime } = computeWindow(date, timeSlot, duration);

    const conflict = await hasConflict(tableId, startDateTime, endDateTime);
    if (conflict) {
      throw new AppError(
        `Table ${table.tableNumber} is already booked for an overlapping time slot`,
        409
      );
    }

    const reservation = await Reservation.create({
      user: req.user._id,
      table: tableId,
      date,
      timeSlot,
      durationMinutes: duration,
      startDateTime,
      endDateTime,
      guests,
    });

    const populated = await reservation.populate('table', 'tableNumber capacity');
    res.status(201).json({ reservation: populated });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/reservations/availability?date=&timeSlot=&guests=&durationMinutes=
// Returns tables free for the requested window — lets the frontend avoid
// showing options that would just fail on submit.
exports.checkAvailability = async (req, res, next) => {
  try {
    const { date, timeSlot, guests, durationMinutes } = req.query;
    if (!date || !timeSlot) {
      throw new AppError('date and timeSlot query params are required', 400);
    }
    if (!DATE_REGEX.test(date) || !TIME_SLOT_REGEX.test(timeSlot)) {
      throw new AppError('Invalid date or timeSlot format', 400);
    }

    const duration = Number(durationMinutes) || 90;
    const { startDateTime, endDateTime } = computeWindow(date, timeSlot, duration);

    const minCapacity = Number(guests) || 1;
    const tables = await Table.find({ isActive: true, capacity: { $gte: minCapacity } }).sort(
      'tableNumber'
    );

    const bookedReservations = await Reservation.find({
      status: 'confirmed',
      startDateTime: { $lt: endDateTime },
      endDateTime: { $gt: startDateTime },
    }).select('table');

    const bookedTableIds = new Set(bookedReservations.map((r) => r.table.toString()));
    const availableTables = tables.filter((t) => !bookedTableIds.has(t._id.toString()));

    res.status(200).json({ availableTables });
  } catch (err) {
    next(err);
  }
};

// @route GET /api/reservations/mine (customer)
exports.getMyReservations = async (req, res, next) => {
  try {
    const reservations = await Reservation.find({ user: req.user._id })
      .populate('table', 'tableNumber capacity')
      .sort('-startDateTime');
    res.status(200).json({ reservations });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/reservations/:id (customer - own reservation only)
exports.cancelMyReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw new AppError('Reservation not found', 404);

    if (reservation.user.toString() !== req.user._id.toString()) {
      throw new AppError('You can only cancel your own reservations', 403);
    }
    if (reservation.status === 'cancelled') {
      throw new AppError('Reservation is already cancelled', 400);
    }

    reservation.status = 'cancelled';
    await reservation.save();
    res.status(200).json({ reservation });
  } catch (err) {
    next(err);
  }
};

// ---------- Admin endpoints ----------

// @route GET /api/reservations (admin) - optional ?date=YYYY-MM-DD filter
exports.getAllReservations = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.date) {
      if (!DATE_REGEX.test(req.query.date)) {
        throw new AppError('date must be in YYYY-MM-DD format', 400);
      }
      filter.date = req.query.date;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const reservations = await Reservation.find(filter)
      .populate('table', 'tableNumber capacity')
      .populate('user', 'name email')
      .sort('-startDateTime');

    res.status(200).json({ reservations });
  } catch (err) {
    next(err);
  }
};

// @route PUT /api/reservations/:id (admin - update any reservation)
exports.adminUpdateReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw new AppError('Reservation not found', 404);

    const { date, timeSlot, durationMinutes, guests, tableId, status } = req.body;

    const nextDate = date || reservation.date;
    const nextTimeSlot = timeSlot || reservation.timeSlot;
    const nextDuration = durationMinutes || reservation.durationMinutes;
    const nextTableId = tableId || reservation.table.toString();
    const nextGuests = guests || reservation.guests;

    if (date && !DATE_REGEX.test(date)) throw new AppError('Invalid date format', 400);
    if (timeSlot && !TIME_SLOT_REGEX.test(timeSlot)) throw new AppError('Invalid timeSlot format', 400);

    // Re-validate capacity/conflict only if something relevant changed
    if (date || timeSlot || durationMinutes || tableId || guests) {
      const table = await Table.findById(nextTableId);
      if (!table || !table.isActive) throw new AppError('Table not found', 404);
      if (nextGuests > table.capacity) {
        throw new AppError(`Table ${table.tableNumber} seats up to ${table.capacity} guests`, 400);
      }

      const { startDateTime, endDateTime } = computeWindow(nextDate, nextTimeSlot, nextDuration);
      const conflict = await hasConflict(nextTableId, startDateTime, endDateTime, reservation._id);
      if (conflict) {
        throw new AppError('Requested change conflicts with an existing reservation', 409);
      }

      reservation.date = nextDate;
      reservation.timeSlot = nextTimeSlot;
      reservation.durationMinutes = nextDuration;
      reservation.table = nextTableId;
      reservation.guests = nextGuests;
      reservation.startDateTime = startDateTime;
      reservation.endDateTime = endDateTime;
    }

    if (status) {
      if (!['confirmed', 'cancelled'].includes(status)) {
        throw new AppError('status must be confirmed or cancelled', 400);
      }
      reservation.status = status;
    }

    await reservation.save();
    const populated = await reservation.populate([
      { path: 'table', select: 'tableNumber capacity' },
      { path: 'user', select: 'name email' },
    ]);

    res.status(200).json({ reservation: populated });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/reservations/:id/admin (admin - cancel any reservation)
exports.adminCancelReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw new AppError('Reservation not found', 404);

    reservation.status = 'cancelled';
    await reservation.save();
    res.status(200).json({ reservation });
  } catch (err) {
    next(err);
  }
};
