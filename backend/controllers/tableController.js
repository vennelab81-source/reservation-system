const Table = require('../models/Table');
const { AppError } = require('../middleware/errorHandler');

// @route GET /api/tables
// Public to authenticated users (customers need this to see options implicitly via availability)
exports.getTables = async (req, res, next) => {
  try {
    const tables = await Table.find({ isActive: true }).sort('tableNumber');
    res.status(200).json({ tables });
  } catch (err) {
    next(err);
  }
};

// @route POST /api/tables (admin only)
exports.createTable = async (req, res, next) => {
  try {
    const { tableNumber, capacity } = req.body;
    if (!tableNumber || !capacity) {
      throw new AppError('tableNumber and capacity are required', 400);
    }

    const existing = await Table.findOne({ tableNumber });
    if (existing) {
      throw new AppError(`Table ${tableNumber} already exists`, 409);
    }

    const table = await Table.create({ tableNumber, capacity });
    res.status(201).json({ table });
  } catch (err) {
    next(err);
  }
};

// @route PUT /api/tables/:id (admin only)
exports.updateTable = async (req, res, next) => {
  try {
    const { capacity, isActive } = req.body;
    const table = await Table.findById(req.params.id);
    if (!table) throw new AppError('Table not found', 404);

    if (capacity !== undefined) table.capacity = capacity;
    if (isActive !== undefined) table.isActive = isActive;
    await table.save();

    res.status(200).json({ table });
  } catch (err) {
    next(err);
  }
};

// @route DELETE /api/tables/:id (admin only)
exports.deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) throw new AppError('Table not found', 404);

    // Soft delete to preserve reservation history integrity
    table.isActive = false;
    await table.save();

    res.status(200).json({ message: 'Table deactivated' });
  } catch (err) {
    next(err);
  }
};
