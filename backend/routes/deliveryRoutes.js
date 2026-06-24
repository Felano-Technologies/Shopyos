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
  getDriverStats,
  verifyDeliveryPin
} = require('../controllers/deliveryController');
const {
  submitVerification,
  getDriverProfile,
  updateAvailability
} = require('../controllers/driverController');
const upload = require('../middleware/upload');
const { protect, driver, hasAnyRole } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');

const driverUploadFields = upload.fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]);

// All delivery routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/deliveries/create:
 *   post:
 *     summary: Create a delivery for an order
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - pickupAddress
 *               - deliveryAddress
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID of the order to create a delivery for
 *               pickupAddress:
 *                 type: string
 *                 description: Pickup address for the delivery
 *               deliveryAddress:
 *                 type: string
 *                 description: Destination address for the delivery
 *     responses:
 *       201:
 *         description: Delivery created successfully
 *       400:
 *         description: Bad request — missing or invalid fields
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller or admin role required
 *       404:
 *         description: Order not found
 */
// @route   POST /api/deliveries/create
// @desc    Create delivery for order
// @access  Private (Seller/Admin)
router.post('/create', hasAnyRole('seller', 'admin'), createDelivery);

/**
 * @swagger
 * /api/v1/deliveries/available:
 *   get:
 *     summary: Get available deliveries for drivers to accept
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of available deliveries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 */
// @route   GET /api/deliveries/available
// @desc    Get available deliveries
// @access  Private (Driver)
router.get('/available', driver, getAvailableDeliveries);

/**
 * @swagger
 * /api/v1/deliveries/my-deliveries:
 *   get:
 *     summary: Get all deliveries assigned to the authenticated driver
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of the driver's deliveries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 */
// @route   GET /api/deliveries/my-deliveries
// @desc    Get driver's deliveries
// @access  Private (Driver)
router.get('/my-deliveries', driver, getMyDeliveries);

/**
 * @swagger
 * /api/v1/deliveries/active:
 *   get:
 *     summary: Get the driver's currently active deliveries
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of active deliveries for the driver
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 */
// @route   GET /api/deliveries/active
// @desc    Get driver's active deliveries
// @access  Private (Driver)
router.get('/active', driver, getActiveDeliveries);

/**
 * @swagger
 * /api/v1/deliveries/driver/stats:
 *   get:
 *     summary: Get delivery statistics for the authenticated driver
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Driver delivery statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDeliveries:
 *                   type: integer
 *                 completedDeliveries:
 *                   type: integer
 *                 cancelledDeliveries:
 *                   type: integer
 *                 averageRating:
 *                   type: number
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 */
// @route   GET /api/deliveries/driver/stats
// @desc    Get delivery statistics for driver
// @access  Private (Driver)
router.get('/driver/stats', driver, getDriverStats);

/**
 * @swagger
 * /api/v1/deliveries/order/{orderId}:
 *   get:
 *     summary: Get the delivery record associated with a specific order
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the order whose delivery record to retrieve
 *     responses:
 *       200:
 *         description: Delivery record for the specified order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Delivery not found for the given order ID
 */
// @route   GET /api/deliveries/order/:orderId
// @desc    Get delivery by order ID
// @access  Private
router.get('/order/:orderId', getDeliveryByOrder);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}:
 *   get:
 *     summary: Get details of a specific delivery
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery to retrieve
 *     responses:
 *       200:
 *         description: Delivery details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Delivery not found
 */
// @route   GET /api/deliveries/:deliveryId
// @desc    Get delivery details
// @access  Private
router.get('/:deliveryId', getDeliveryDetails);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/assign:
 *   put:
 *     summary: Assign the authenticated driver to a delivery
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery to assign the driver to
 *     responses:
 *       200:
 *         description: Driver successfully assigned to the delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 *       404:
 *         description: Delivery not found
 */
// @route   PUT /api/deliveries/:deliveryId/assign
// @desc    Assign driver to delivery
// @access  Private (Driver)
router.put('/:deliveryId/assign', driver, assignDriver);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/status:
 *   put:
 *     summary: Update the status of a delivery
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New delivery status
 *                 enum: [pending, picked_up, in_transit, delivered, cancelled]
 *     responses:
 *       200:
 *         description: Delivery status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request — invalid status value
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 *       404:
 *         description: Delivery not found
 */
// @route   PUT /api/deliveries/:deliveryId/status
// @desc    Update delivery status
// @access  Private (Driver)
router.put('/:deliveryId/status', driver, auditLog('update_delivery_status', 'delivery'), updateDeliveryStatus);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/verify-pin:
 *   post:
 *     summary: Verify the delivery PIN to confirm handoff and release funds
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery to verify
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pin
 *             properties:
 *               pin:
 *                 type: string
 *                 description: PIN provided by the recipient to confirm delivery
 *     responses:
 *       200:
 *         description: PIN verified; funds released
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request — missing or incorrect PIN
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 *       404:
 *         description: Delivery not found
 */
// @route   POST /api/deliveries/:deliveryId/verify-pin
// @desc    Verify delivery PIN and release funds
// @access  Private (Driver)
router.post('/:deliveryId/verify-pin', driver, verifyDeliveryPin);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/location:
 *   post:
 *     summary: Add a real-time location update for a delivery
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery to update location for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 format: double
 *                 description: Current latitude of the driver
 *               longitude:
 *                 type: number
 *                 format: double
 *                 description: Current longitude of the driver
 *     responses:
 *       200:
 *         description: Location update recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request — missing or invalid coordinates
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 *       404:
 *         description: Delivery not found
 */
// @route   POST /api/deliveries/:deliveryId/location
// @desc    Add location update
// @access  Private (Driver)
router.post('/:deliveryId/location', driver, addLocationUpdate);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/location:
 *   put:
 *     summary: Update driver location for a delivery (alias for background tracking)
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery to update location for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 format: double
 *                 description: Current latitude of the driver
 *               longitude:
 *                 type: number
 *                 format: double
 *                 description: Current longitude of the driver
 *     responses:
 *       200:
 *         description: Location update recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request — missing or invalid coordinates
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 *       404:
 *         description: Delivery not found
 */
// @route   PUT /api/deliveries/:deliveryId/location (alias for POST)
// @desc    Update driver location (alias for background tracking)
// @access  Private (Driver)
router.put('/:deliveryId/location', driver, addLocationUpdate);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/location:
 *   get:
 *     summary: Get all location updates for a delivery
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery whose location history to retrieve
 *     responses:
 *       200:
 *         description: List of location updates for the delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Delivery not found
 */
// @route   GET /api/deliveries/:deliveryId/location
// @desc    Get location updates
// @access  Private
router.get('/:deliveryId/location', getLocationUpdates);

/**
 * @swagger
 * /api/v1/deliveries/{deliveryId}/latest-location:
 *   get:
 *     summary: Get the most recent location update for a delivery
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the delivery whose latest location to retrieve
 *     responses:
 *       200:
 *         description: Latest location update for the delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 latitude:
 *                   type: number
 *                 longitude:
 *                   type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Delivery or location not found
 */
// @route   GET /api/deliveries/:deliveryId/latest-location
// @desc    Get latest location
// @access  Private
router.get('/:deliveryId/latest-location', getLatestLocation);

/**
 * @swagger
 * /api/v1/deliveries/verify:
 *   post:
 *     summary: Submit driver verification documents
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               idCard:
 *                 type: string
 *                 format: binary
 *                 description: Government-issued ID card image
 *               licenseFront:
 *                 type: string
 *                 format: binary
 *                 description: Front side of driver's license
 *               licenseBack:
 *                 type: string
 *                 format: binary
 *                 description: Back side of driver's license
 *               insurance:
 *                 type: string
 *                 format: binary
 *                 description: Vehicle insurance document
 *               profilePhoto:
 *                 type: string
 *                 format: binary
 *                 description: Driver profile photo
 *     responses:
 *       200:
 *         description: Verification documents submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Bad request — missing or invalid documents
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 */
// @route   POST /api/deliveries/verify
// @desc    Submit driver verification details
// @access  Private (Driver)
router.post('/verify', driver, driverUploadFields, submitVerification);

/**
 * @swagger
 * /api/v1/deliveries/driver/profile:
 *   get:
 *     summary: Get the authenticated driver's profile
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Driver profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 available:
 *                   type: boolean
 *                 verificationStatus:
 *                   type: string
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 *       404:
 *         description: Driver profile not found
 */
// @route   GET /api/deliveries/driver/profile
// @desc    Get driver profile
// @access  Private (Driver)
router.get('/driver/profile', driver, getDriverProfile);

/**
 * @swagger
 * /api/v1/deliveries/driver/availability:
 *   put:
 *     summary: Update the authenticated driver's availability status
 *     tags: [Delivery]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - available
 *             properties:
 *               available:
 *                 type: boolean
 *                 description: Whether the driver is available to accept new deliveries
 *     responses:
 *       200:
 *         description: Driver availability updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *       400:
 *         description: Bad request — missing or invalid availability value
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — driver role required
 */
// @route   PUT /api/deliveries/driver/availability
// @desc    Update driver availability
// @access  Private (Driver)
router.put('/driver/availability', driver, updateAvailability);

module.exports = router;
