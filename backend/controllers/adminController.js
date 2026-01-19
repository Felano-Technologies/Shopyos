// controllers/adminController.js
// Admin controller for user management, store verification, and platform analytics

const repositories = require('../db/repositories');

/**
 * Get dashboard analytics
 * @route   GET /api/admin/dashboard
 * @access  Admin
 */
const getDashboard = async (req, res) => {
  try {
    const [userStats, storeStats, platformAnalytics, reportStats] = await Promise.all([
      repositories.admin.getUserStats(),
      repositories.admin.getStoreStats(),
      repositories.admin.getPlatformAnalytics(),
      repositories.reports.getReportStats()
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        users: userStats,
        stores: storeStats,
        platform: platformAnalytics,
        reports: reportStats
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      details: error.message
    });
  }
};

/**
 * Get all users
 * @route   GET /api/admin/users
 * @access  Admin
 */
const getAllUsers = async (req, res) => {
  try {
    const { limit, offset, role, accountStatus, search } = req.query;

    const users = await repositories.admin.getAllUsers({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      role,
      accountStatus,
      search
    });

    res.status(200).json({
      success: true,
      users,
      pagination: {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      details: error.message
    });
  }
};

/**
 * Update user status
 * @route   PUT /api/admin/users/:userId/status
 * @access  Admin
 */
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be active, suspended, or banned'
      });
    }

    const user = await repositories.admin.updateUserStatus(userId, status, reason);

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'update_user_status',
      entityType: 'user',
      entityId: userId,
      changes: { status, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user status',
      details: error.message
    });
  }
};

/**
 * Update user role
 * @route   PUT /api/admin/users/:userId/role
 * @access  Admin
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['buyer', 'seller', 'driver', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    const user = await repositories.admin.updateUserRole(userId, role);

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'update_user_role',
      entityType: 'user',
      entityId: userId,
      changes: { role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
      details: error.message
    });
  }
};

/**
 * Get all stores
 * @route   GET /api/admin/stores
 * @access  Admin
 */
const getAllStores = async (req, res) => {
  try {
    const { limit, offset, verificationStatus, search } = req.query;

    const stores = await repositories.admin.getAllStores({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      verificationStatus,
      search
    });

    res.status(200).json({
      success: true,
      stores,
      pagination: {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores',
      details: error.message
    });
  }
};

/**
 * Update store verification status
 * @route   PUT /api/admin/stores/:storeId/verify
 * @access  Admin
 */
const verifyStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status, reason } = req.body;

    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification status'
      });
    }

    const store = await repositories.admin.updateStoreVerification(storeId, status, reason);

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'verify_store',
      entityType: 'store',
      entityId: storeId,
      changes: { verification_status: status, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      message: 'Store verification status updated successfully',
      store
    });
  } catch (error) {
    console.error('Verify store error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update verification status',
      details: error.message
    });
  }
};

/**
 * Update store status
 * @route   PUT /api/admin/stores/:storeId/status
 * @access  Admin
 */
const updateStoreStatus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const store = await repositories.admin.updateStoreStatus(storeId, status);

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'update_store_status',
      entityType: 'store',
      entityId: storeId,
      changes: { status },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      message: 'Store status updated successfully',
      store
    });
  } catch (error) {
    console.error('Update store status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update store status',
      details: error.message
    });
  }
};

/**
 * Get all reports
 * @route   GET /api/admin/reports
 * @access  Admin
 */
const getAllReports = async (req, res) => {
  try {
    const { status, reportedType, limit, offset } = req.query;

    const reports = await repositories.reports.getAllReports({
      status,
      reportedType,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.status(200).json({
      success: true,
      reports,
      pagination: {
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Get all reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
      details: error.message
    });
  }
};

/**
 * Get report details
 * @route   GET /api/admin/reports/:reportId
 * @access  Admin
 */
const getReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await repositories.reports.getReportDetails(reportId);

    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Get report details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report details',
      details: error.message
    });
  }
};

/**
 * Update report status
 * @route   PUT /api/admin/reports/:reportId
 * @access  Admin
 */
const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, resolution } = req.body;

    if (!['pending', 'under_review', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const report = await repositories.reports.updateReportStatus(
      reportId,
      status,
      req.user.id,
      resolution
    );

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'review_report',
      entityType: 'report',
      entityId: reportId,
      changes: { status, resolution },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      message: 'Report status updated successfully',
      report
    });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report status',
      details: error.message
    });
  }
};

/**
 * Get audit logs
 * @route   GET /api/admin/audit-logs
 * @access  Admin
 */
const getAuditLogs = async (req, res) => {
  try {
    const { userId, action, entityType, startDate, endDate, limit, offset } = req.query;

    const logs = await repositories.auditLogs.getAuditLogs({
      userId,
      action,
      entityType,
      startDate,
      endDate,
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    });

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      details: error.message
    });
  }
};

/**
 * Get entity audit trail
 * @route   GET /api/admin/audit-logs/:entityType/:entityId
 * @access  Admin
 */
const getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const history = await repositories.auditLogs.getEntityHistory(entityId, entityType);

    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Get entity history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entity history',
      details: error.message
    });
  }
};

module.exports = {
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
};
