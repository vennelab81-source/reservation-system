const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    timeSlot: { type: String, required: true }, // e.g. '18:00'
    durationMinutes: { type: Number, default: 90 },
    startDateTime: { type: Date, required: true }, // computed: date + timeSlot
    endDateTime: { type: Date, required: true }, // computed: startDateTime + duration
    guests: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed',
    },
  },
  { timestamps: true }
);

// Speeds up the overlap-conflict query used on every booking attempt
reservationSchema.index({ table: 1, status: 1, startDateTime: 1, endDateTime: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
