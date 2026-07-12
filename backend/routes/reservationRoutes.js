const express = require('express');
const router = express.Router();
const {
  createReservation,
  checkAvailability,
  getMyReservations,
  cancelMyReservation,
  getAllReservations,
  adminUpdateReservation,
  adminCancelReservation,
} = require('../controllers/reservationController');
const { protect, authorize } = require('../middleware/auth');

// Customer routes
router.post('/', protect, createReservation);
router.get('/availability', protect, checkAvailability);
router.get('/mine', protect, getMyReservations);
router.delete('/:id', protect, cancelMyReservation);

// Admin routes
router.get('/', protect, authorize('admin'), getAllReservations);
router.put('/:id', protect, authorize('admin'), adminUpdateReservation);
router.delete('/:id/admin', protect, authorize('admin'), adminCancelReservation);

module.exports = router;
