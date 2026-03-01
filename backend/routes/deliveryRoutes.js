// routes/deliveryRoutes.js
// Delivery tracking and management routes

const express = require('express');
const router = express.Router();
const {
  createDelivery,
  getAvailableDeliveries,
  assignDriver,
  getMyDeliveries,
  getActiveDeliveries,
  getDeliveryDetails,
  updateDeliveryStatus,
  addLocationUpdate,
  getLocationUpdates,
  getLatestLocation,
  getDeliveryByOrder,
  getDriverStats
} = require('../controllers/deliveryController');
const { protect, driver, hasAnyRole } = require('../middleware/authMiddleware');

// All delivery routes require authentication
router.use(protect);

// @route   POST /api/deliveries/create
// @desc    Create delivery for order
// @access  Private (Seller/Admin)
router.post('/create', hasAnyRole('seller', 'admin'), createDelivery);

// @route   GET /api/deliveries/available
// @desc    Get available deliveries
// @access  Private (Driver)
router.get('/available', driver, getAvailableDeliveries);

// @route   GET /api/deliveries/my-deliveries
// @desc    Get driver's deliveries
// @access  Private (Driver)
router.get('/my-deliveries', driver, getMyDeliveries);

// @route   GET /api/deliveries/active
// @desc    Get driver's active deliveries
// @access  Private (Driver)
router.get('/active', driver, getActiveDeliveries);

// @route   GET /api/deliveries/driver/stats
// @desc    Get delivery statistics for driver
// @access  Private (Driver)
router.get('/driver/stats', driver, getDriverStats);

// @route   GET /api/deliveries/order/:orderId
// @desc    Get delivery by order ID
// @access  Private
router.get('/order/:orderId', getDeliveryByOrder);

// @route   GET /api/deliveries/:deliveryId
// @desc    Get delivery details
// @access  Private
router.get('/:deliveryId', getDeliveryDetails);

// @route   PUT /api/deliveries/:deliveryId/assign
// @desc    Assign driver to delivery
// @access  Private (Driver)
router.put('/:deliveryId/assign', driver, assignDriver);

// @route   PUT /api/deliveries/:deliveryId/status
// @desc    Update delivery status
// @access  Private (Driver)
router.put('/:deliveryId/status', driver, updateDeliveryStatus);

// @route   POST /api/deliveries/:deliveryId/location
// @desc    Add location update
// @access  Private (Driver)
router.post('/:deliveryId/location', driver, addLocationUpdate);

// @route   PUT /api/deliveries/:deliveryId/location (alias for POST)
// @desc    Update driver location (alias for background tracking)
// @access  Private (Driver)
router.put('/:deliveryId/location', driver, addLocationUpdate);

// @route   GET /api/deliveries/:deliveryId/location
// @desc    Get location updates
// @access  Private
router.get('/:deliveryId/location', getLocationUpdates);

// @route   GET /api/deliveries/:deliveryId/latest-location
// @desc    Get latest location
// @access  Private
router.get('/:deliveryId/latest-location', getLatestLocation);

module.exports = router;
