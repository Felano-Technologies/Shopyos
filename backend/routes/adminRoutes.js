// routes/adminRoutes.js
// Admin routes for user management, store verification, and platform analytics

const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getAllUsers,
  getUserStats,
  updateUserStatus,
  updateUserRole,
  getAllStores,
  verifyStore,
  updateStoreStatus,
  getAuditLogs,
  getEntityHistory,
  getAllPayouts,
  updatePayoutStatus,
  getAllReports,
  updateReportStatus,
  getAllOrders,
  getRevenue,
  getRevenueBreakdown,
  getDriverVerifications,
  getDriverVerificationDetails,
  approveDriverVerification,
  rejectDriverVerification,
  getReportDetails,
  getAllEscrows,
  refundEscrow,
  releaseEscrow,
  deleteUser,
  resetUserSession,
  disableUserSession,
  createUserProfile,
  createStoreAdmin,
  createDriverProfileAdmin,
  getDriverStatsAdmin,
  getDriverHistoryAdmin,
  getPlatformSettings,
  updatePlatformSettings,
} = require('../controllers/adminController');
const {
  getScheduledNotifications,
  createScheduledNotification,
  cancelScheduledNotification,
  previewHolidayCampaign,
  triggerMarketingSweep,
  sendTestNotification
} = require('../controllers/adminNotificationController');
const { protect, admin } = require('../middleware/authMiddleware');
const { cacheMiddleware } = require('../middleware/cache');
const adminExportController = require('../controllers/adminExportController');
const {
  getFeeConfigs,
  getFeeConfigByKey,
  updateFeeConfig,
  getFeeConfigAudit,
} = require('../controllers/feeConfigController');
const {
  adminGetAllHubs,
  adminCreateHub,
  adminUpdateHub,
  adminToggleHub,
  adminGetTransitRoutes,
  adminUpsertTransitRoute,
} = require('../controllers/parcelPartnerController');
const {
  updateDisclaimer,
  getAcknowledgementsAudit,
} = require('../controllers/disclaimerController');
const {
  getListingFees,
} = require('../controllers/listingFeeController');

// All admin routes require authentication and admin role
router.use(protect);
router.use(admin);

// Platform Settings (must be before any /:id routes)
/**
 * @swagger
 * /api/v1/admin/platform-settings:
 *   get:
 *     summary: Get platform settings
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Platform settings retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/platform-settings', getPlatformSettings);

/**
 * @swagger
 * /api/v1/admin/platform-settings:
 *   put:
 *     summary: Update platform settings
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maintenanceMode:
 *                 type: boolean
 *               commissionRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Platform settings updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.put('/platform-settings', updatePlatformSettings);

// Platform Fee Configuration
router.get('/fee-config', getFeeConfigs);
router.get('/fee-config/:key', getFeeConfigByKey);
router.put('/fee-config/:key', updateFeeConfig);
router.get('/fee-config/audit/:key', getFeeConfigAudit);

// Logistics Hub Management
router.get('/hubs', adminGetAllHubs);
router.post('/hubs', adminCreateHub);
router.put('/hubs/:hubId', adminUpdateHub);
router.patch('/hubs/:hubId/toggle', adminToggleHub);

// Transit Route Configuration
router.get('/transit-routes', adminGetTransitRoutes);
router.post('/transit-routes', adminUpsertTransitRoute);

// Disclaimer Management
router.put('/disclaimers/:type', updateDisclaimer);
router.get('/disclaimers/audit', getAcknowledgementsAudit);

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard overview
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/dashboard', cacheMiddleware(() => 'shopyos:admin:dashboard', 300), getDashboard);

// User Management
/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Get all users with optional filtering
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by user status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/users', getAllUsers);

/**
 * @swagger
 * /api/v1/admin/users/stats:
 *   get:
 *     summary: Get aggregate user statistics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/users/stats', getUserStats);

/**
 * @swagger
 * /api/v1/admin/users/create:
 *   post:
 *     summary: Create a new user profile
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/users/create', createUserProfile);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/status:
 *   put:
 *     summary: Update a user's account status
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to update
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
 *     responses:
 *       200:
 *         description: User status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.put('/users/:userId/status', updateUserStatus);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/role:
 *   put:
 *     summary: Update a user's role
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.put('/users/:userId/role', updateUserRole);

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   delete:
 *     summary: Delete a user account
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to delete
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.delete('/users/:userId', deleteUser);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/reset-session:
 *   post:
 *     summary: Reset all active sessions for a user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user whose session will be reset
 *     responses:
 *       200:
 *         description: User session reset successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.post('/users/:userId/reset-session', resetUserSession);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/disable-session:
 *   post:
 *     summary: Disable all active sessions for a user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user whose sessions will be disabled
 *     responses:
 *       200:
 *         description: User sessions disabled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.post('/users/:userId/disable-session', disableUserSession);

// Store Management
/**
 * @swagger
 * /api/v1/admin/stores/create:
 *   post:
 *     summary: Create a new store as admin
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ownerId
 *             properties:
 *               name:
 *                 type: string
 *               ownerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Store created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/stores/create', createStoreAdmin);

/**
 * @swagger
 * /api/v1/admin/stores:
 *   get:
 *     summary: Get all stores with optional filtering
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by store status
 *     responses:
 *       200:
 *         description: Stores retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/stores', getAllStores);

/**
 * @swagger
 * /api/v1/admin/stores/{storeId}/verify:
 *   put:
 *     summary: Verify a store
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the store to verify
 *     responses:
 *       200:
 *         description: Store verified successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Store not found
 */
router.put('/stores/:storeId/verify', verifyStore);

/**
 * @swagger
 * /api/v1/admin/stores/{storeId}/status:
 *   put:
 *     summary: Update a store's status
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the store to update
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
 *     responses:
 *       200:
 *         description: Store status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Store not found
 */
router.put('/stores/:storeId/status', updateStoreStatus);

// Content Moderation
/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     summary: Get all content reports
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/reports', getAllReports);

/**
 * @swagger
 * /api/v1/admin/reports/{reportId}:
 *   get:
 *     summary: Get details for a specific report
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the report
 *     responses:
 *       200:
 *         description: Report details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Report not found
 */
router.get('/reports/:reportId', getReportDetails);

/**
 * @swagger
 * /api/v1/admin/reports/{reportId}:
 *   put:
 *     summary: Update a report's status or notes
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the report to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Report not found
 */
router.put('/reports/:reportId', updateReportStatus);

// Audit Logs
/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: Get audit logs with optional filtering
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/audit-logs', getAuditLogs);

/**
 * @swagger
 * /api/v1/admin/audit-logs/{entityType}/{entityId}:
 *   get:
 *     summary: Get audit history for a specific entity
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type of entity (e.g. user, store, order)
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the entity
 *     responses:
 *       200:
 *         description: Entity audit history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Entity not found
 */
router.get('/audit-logs/:entityType/:entityId', getEntityHistory);

// Payout Management
/**
 * @swagger
 * /api/v1/admin/payouts:
 *   get:
 *     summary: Get all payouts with optional filtering
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by payout status
 *     responses:
 *       200:
 *         description: Payouts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/payouts', getAllPayouts);

/**
 * @swagger
 * /api/v1/admin/payouts/{payoutId}:
 *   put:
 *     summary: Update a payout's status
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the payout to update
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
 *     responses:
 *       200:
 *         description: Payout status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Payout not found
 */
router.put('/payouts/:payoutId', updatePayoutStatus);

// Order Management
/**
 * @swagger
 * /api/v1/admin/orders:
 *   get:
 *     summary: Get all orders with optional filtering
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of results per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/orders', getAllOrders);

// Revenue
/**
 * @swagger
 * /api/v1/admin/revenue:
 *   get:
 *     summary: Get revenue data within a date range
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for revenue range (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for revenue range (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Revenue data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/revenue', getRevenue);
router.get('/revenue-breakdown', getRevenueBreakdown);

// Driver Management
/**
 * @swagger
 * /api/v1/admin/drivers/create:
 *   post:
 *     summary: Create a driver profile as admin
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - vehicleType
 *             properties:
 *               userId:
 *                 type: string
 *               vehicleType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Driver profile created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/drivers/create', createDriverProfileAdmin);

/**
 * @swagger
 * /api/v1/admin/drivers/{id}/stats:
 *   get:
 *     summary: Get statistics for a specific driver
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the driver
 *     responses:
 *       200:
 *         description: Driver statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Driver not found
 */
router.get('/drivers/:id/stats', getDriverStatsAdmin);

/**
 * @swagger
 * /api/v1/admin/drivers/{id}/deliveries:
 *   get:
 *     summary: Get delivery history for a specific driver
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the driver
 *     responses:
 *       200:
 *         description: Driver delivery history retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Driver not found
 */
router.get('/drivers/:id/deliveries', getDriverHistoryAdmin);

// Driver Verifications
/**
 * @swagger
 * /api/v1/admin/driver-verifications:
 *   get:
 *     summary: Get all pending driver verification requests
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Driver verifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/driver-verifications', getDriverVerifications);

/**
 * @swagger
 * /api/v1/admin/driver-verifications/{id}:
 *   get:
 *     summary: Get details for a specific driver verification request
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the driver verification
 *     responses:
 *       200:
 *         description: Driver verification details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Driver verification not found
 */
router.get('/driver-verifications/:id', getDriverVerificationDetails);

/**
 * @swagger
 * /api/v1/admin/driver-verifications/{id}/approve:
 *   put:
 *     summary: Approve a driver verification request
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the driver verification to approve
 *     responses:
 *       200:
 *         description: Driver verification approved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Driver verification not found
 */
router.put('/driver-verifications/:id/approve', approveDriverVerification);

/**
 * @swagger
 * /api/v1/admin/driver-verifications/{id}/reject:
 *   put:
 *     summary: Reject a driver verification request
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the driver verification to reject
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Driver verification rejected successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Driver verification not found
 */
router.put('/driver-verifications/:id/reject', rejectDriverVerification);

// Escrow Management
/**
 * @swagger
 * /api/v1/admin/escrows:
 *   get:
 *     summary: Get all escrow records
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Escrows retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/escrows', getAllEscrows);

/**
 * @swagger
 * /api/v1/admin/escrows/{id}/refund:
 *   put:
 *     summary: Refund an escrow back to the buyer
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the escrow to refund
 *     responses:
 *       200:
 *         description: Escrow refunded successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Escrow not found
 */
router.put('/escrows/:id/refund', refundEscrow);

/**
 * @swagger
 * /api/v1/admin/escrows/{id}/release:
 *   put:
 *     summary: Release an escrow to the seller
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the escrow to release
 *     responses:
 *       200:
 *         description: Escrow released successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Escrow not found
 */
router.put('/escrows/:id/release', releaseEscrow);

// Listing Fees
router.get('/listing-fees', getListingFees);

// Export
/**
 * @swagger
 * /api/v1/admin/export/{resource}:
 *   get:
 *     summary: Export a platform resource in the specified format
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resource
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the resource to export (e.g. users, orders, revenue)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *         description: Export format
 *     responses:
 *       200:
 *         description: Resource exported successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Resource not found
 */
router.get('/export/:resource', adminExportController.exportResource);

// ─── Scheduled Broadcast Notifications ───────────────────────────────────────
// Sub-paths BEFORE /:id to prevent shadowing

/**
 * @swagger
 * /api/v1/admin/scheduled-notifications/holiday-preview:
 *   get:
 *     summary: Preview the upcoming holiday campaign notifications
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Holiday campaign preview retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/scheduled-notifications/holiday-preview', previewHolidayCampaign);

/**
 * @swagger
 * /api/v1/admin/scheduled-notifications/trigger-sweep:
 *   post:
 *     summary: Manually trigger the marketing notification sweep
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Marketing sweep triggered successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/scheduled-notifications/trigger-sweep', triggerMarketingSweep);

/**
 * @swagger
 * /api/v1/admin/scheduled-notifications/send-test:
 *   post:
 *     summary: Send a test notification to a specific user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - title
 *               - message
 *             properties:
 *               userId:
 *                 type: string
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.post('/scheduled-notifications/send-test', sendTestNotification);

// CRUD
/**
 * @swagger
 * /api/v1/admin/scheduled-notifications:
 *   get:
 *     summary: Get all scheduled broadcast notifications
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled notifications retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/scheduled-notifications', getScheduledNotifications);

/**
 * @swagger
 * /api/v1/admin/scheduled-notifications:
 *   post:
 *     summary: Create a new scheduled broadcast notification
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *               - scheduledAt
 *               - audience
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               audience:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scheduled notification created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/scheduled-notifications', createScheduledNotification);

/**
 * @swagger
 * /api/v1/admin/scheduled-notifications/{id}:
 *   delete:
 *     summary: Cancel and delete a scheduled notification
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the scheduled notification to cancel
 *     responses:
 *       200:
 *         description: Scheduled notification cancelled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Scheduled notification not found
 */
router.delete('/scheduled-notifications/:id', cancelScheduledNotification);

module.exports = router;
