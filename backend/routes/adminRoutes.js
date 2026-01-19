// routes/adminRoutes.js
// Admin routes for user management, store verification, and platform analytics

const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  getAllStores,
  verifyStore,
  updateStoreStatus,
  getAllReports,
  getReportDetails,
  updateReportStatus,
  getAuditLogs,
  getEntityHistory
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(admin);

// @route   GET /api/admin/dashboard
// @desc    Get dashboard analytics
// @access  Admin
router.get('/dashboard', getDashboard);

// User Management
// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Admin
router.get('/users', getAllUsers);

// @route   PUT /api/admin/users/:userId/status
// @desc    Update user account status
// @access  Admin
router.put('/users/:userId/status', updateUserStatus);

// @route   PUT /api/admin/users/:userId/role
// @desc    Update user role
// @access  Admin
router.put('/users/:userId/role', updateUserRole);

// Store Management
// @route   GET /api/admin/stores
// @desc    Get all stores with filters
// @access  Admin
router.get('/stores', getAllStores);

// @route   PUT /api/admin/stores/:storeId/verify
// @desc    Update store verification status
// @access  Admin
router.put('/stores/:storeId/verify', verifyStore);

// @route   PUT /api/admin/stores/:storeId/status
// @desc    Update store status
// @access  Admin
router.put('/stores/:storeId/status', updateStoreStatus);

// Content Moderation
// @route   GET /api/admin/reports
// @desc    Get all reports
// @access  Admin
router.get('/reports', getAllReports);

// @route   GET /api/admin/reports/:reportId
// @desc    Get report details
// @access  Admin
router.get('/reports/:reportId', getReportDetails);

// @route   PUT /api/admin/reports/:reportId
// @desc    Update report status
// @access  Admin
router.put('/reports/:reportId', updateReportStatus);

// Audit Logs
// @route   GET /api/admin/audit-logs
// @desc    Get audit logs with filters
// @access  Admin
router.get('/audit-logs', getAuditLogs);

// @route   GET /api/admin/audit-logs/:entityType/:entityId
// @desc    Get entity audit trail
// @access  Admin
router.get('/audit-logs/:entityType/:entityId', getEntityHistory);

module.exports = router;
