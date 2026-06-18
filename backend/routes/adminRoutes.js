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
const adminExportController = require('../controllers/adminExportController');

// All admin routes require authentication and admin role
router.use(protect);
router.use(admin);

// @route   GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

// User Management
// @route   GET /api/admin/users
router.get('/users', getAllUsers);

// @route   GET /api/admin/users/stats  (must be before /:userId routes)
router.get('/users/stats', getUserStats);

// @route   POST /api/admin/users/create  (must be before /:userId routes)
router.post('/users/create', createUserProfile);

// @route   PUT /api/admin/users/:userId/status
router.put('/users/:userId/status', updateUserStatus);

// @route   PUT /api/admin/users/:userId/role
router.put('/users/:userId/role', updateUserRole);

// @route   DELETE /api/admin/users/:userId
router.delete('/users/:userId', deleteUser);

// @route   POST /api/admin/users/:userId/reset-session
router.post('/users/:userId/reset-session', resetUserSession);

// @route   POST /api/admin/users/:userId/disable-session
router.post('/users/:userId/disable-session', disableUserSession);

// Store Management
// @route   POST /api/admin/stores/create  (must be before /:storeId routes)
router.post('/stores/create', createStoreAdmin);

// @route   GET /api/admin/stores
router.get('/stores', getAllStores);

// @route   PUT /api/admin/stores/:storeId/verify
router.put('/stores/:storeId/verify', verifyStore);

// @route   PUT /api/admin/stores/:storeId/status
router.put('/stores/:storeId/status', updateStoreStatus);

// Content Moderation
// @route   GET /api/admin/reports
router.get('/reports', getAllReports);

// @route   GET /api/admin/reports/:reportId
router.get('/reports/:reportId', getReportDetails);

// @route   PUT /api/admin/reports/:reportId
router.put('/reports/:reportId', updateReportStatus);

// Audit Logs
// @route   GET /api/admin/audit-logs
router.get('/audit-logs', getAuditLogs);

// @route   GET /api/admin/audit-logs/:entityType/:entityId
router.get('/audit-logs/:entityType/:entityId', getEntityHistory);

// Payout Management
// @route   GET /api/admin/payouts
router.get('/payouts', getAllPayouts);

// @route   PUT /api/admin/payouts/:payoutId
router.put('/payouts/:payoutId', updatePayoutStatus);

// Order Management
// @route   GET /api/admin/orders
router.get('/orders', getAllOrders);

// Revenue
// @route   GET /api/admin/revenue
router.get('/revenue', getRevenue);

// Driver Management
// @route   POST /api/admin/drivers/create
router.post('/drivers/create', createDriverProfileAdmin);

// @route   GET /api/admin/drivers/:id/stats
router.get('/drivers/:id/stats', getDriverStatsAdmin);

// @route   GET /api/admin/drivers/:id/deliveries
router.get('/drivers/:id/deliveries', getDriverHistoryAdmin);

// Driver Verifications
// @route   GET /api/admin/driver-verifications
router.get('/driver-verifications', getDriverVerifications);

// @route   GET /api/admin/driver-verifications/:id
router.get('/driver-verifications/:id', getDriverVerificationDetails);

// @route   PUT /api/admin/driver-verifications/:id/approve
router.put('/driver-verifications/:id/approve', approveDriverVerification);

// @route   PUT /api/admin/driver-verifications/:id/reject
router.put('/driver-verifications/:id/reject', rejectDriverVerification);

// Escrow Management
// @route   GET /api/admin/escrows
router.get('/escrows', getAllEscrows);

// @route   PUT /api/admin/escrows/:id/refund
router.put('/escrows/:id/refund', refundEscrow);

// @route   PUT /api/admin/escrows/:id/release
router.put('/escrows/:id/release', releaseEscrow);

// Export
// @route   GET /api/admin/export/:resource
router.get('/export/:resource', adminExportController.exportResource);

// ─── Scheduled Broadcast Notifications ───────────────────────────────────────
// Sub-paths BEFORE /:id to prevent shadowing
router.get('/scheduled-notifications/holiday-preview', previewHolidayCampaign);
router.post('/scheduled-notifications/trigger-sweep', triggerMarketingSweep);
router.post('/scheduled-notifications/send-test', sendTestNotification);
// CRUD
router.get('/scheduled-notifications', getScheduledNotifications);
router.post('/scheduled-notifications', createScheduledNotification);
router.delete('/scheduled-notifications/:id', cancelScheduledNotification);

module.exports = router;
