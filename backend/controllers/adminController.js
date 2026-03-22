// controllers/adminController.js
// Admin controller for user management, store verification, and platform analytics

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');

/**
 * Get dashboard analytics
 * @route   GET /api/admin/dashboard
 * @access  Admin
 */
const getDashboard = async (req, res, next) => {
  try {
    const [userCount, storeCount, orderCount, revenueRes] = await Promise.all([
      repositories.users.count(),
      repositories.stores.count(),
      repositories.orders.count(),
      repositories.orders.customQuery(q => q.select('payments(amount)'))
    ]);

    const totalRevenue = revenueRes?.reduce((sum, order) => sum + parseFloat(order.payments?.[0]?.amount || 0), 0) || 0;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers: userCount,
        totalStores: storeCount,
        totalOrders: orderCount,
        totalRevenue: totalRevenue,
        pendingPayouts: 0, // In a real app, count from payouts repo
        activePromotions: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users
 * @route   GET /api/admin/users
 * @access  Admin
 */
const getAllUsers = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Update user status
 * @route   PUT /api/admin/users/:userId/status
 * @access  Admin
 */
const updateUserStatus = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Update user role
 * @route   PUT /api/admin/users/:userId/role
 * @access  Admin
 */
const updateUserRole = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get all stores
 * @route   GET /api/admin/stores
 * @access  Admin
 */
const getAllStores = async (req, res, next) => {
  try {
    const { limit, offset, verificationStatus, search, id } = req.query;

    const stores = await repositories.admin.getAllStores({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      verificationStatus,
      search,
      id
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
    next(error);
  }
};

/**
 * Update store verification status
 * @route   PUT /api/admin/stores/:storeId/verify
 * @access  Admin
 */
const verifyStore = async (req, res, next) => {
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

    // Sync the is_verified boolean to match the verification_status
    await repositories.stores.update(storeId, {
      is_verified: status === 'verified'
    });

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
      message: `Store ${status === 'verified' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated'} successfully`,
      store
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update store status
 * @route   PUT /api/admin/stores/:storeId/status
 * @access  Admin
 */
const updateStoreStatus = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get all reports
 * @route   GET /api/admin/reports
 * @access  Admin
 */
const getAllReports = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get report details
 * @route   GET /api/admin/reports/:reportId
 * @access  Admin
 */
const getReportDetails = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const report = await repositories.reports.getReportDetails(reportId);

    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update report status
 * @route   PUT /api/admin/reports/:reportId
 * @access  Admin
 */
const updateReportStatus = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get audit logs
 * @route   GET /api/admin/audit-logs
 * @access  Admin
 */
const getAuditLogs = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get entity audit trail
 * @route   GET /api/admin/audit-logs/:entityType/:entityId
 * @access  Admin
 */
const getEntityHistory = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const history = await repositories.auditLogs.getEntityHistory(entityId, entityType);

    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payouts
 * @route   GET /api/admin/payouts
 * @access  Admin
 */
const getAllPayouts = async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const payouts = await repositories.payouts.findAll({
      where: status ? { status } : {},
      orderBy: 'created_at',
      ascending: false,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.status(200).json({
      success: true,
      data: Array.isArray(payouts) ? payouts : (payouts?.data || [])
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update payout status
 * @route   PUT /api/admin/payouts/:payoutId
 * @access  Admin
 */
const updatePayoutStatus = async (req, res, next) => {
  try {
    const { payoutId } = req.params;
    const { status, notes } = req.body;

    const payout = await repositories.payouts.findById(payoutId);
    if (!payout) return res.status(404).json({ success: false, error: 'Payout not found' });

    // Update status
    const updated = await repositories.payouts.update(payoutId, {
      status,
      processed_at: status === 'completed' ? new Date().toISOString() : null,
      notes: notes || payout.notes
    });

    res.status(200).json({
      success: true,
      message: `Payout ${status} successfully`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all orders (admin)
 * @route   GET /api/admin/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, limit, offset } = req.query;
    const orders = await repositories.admin.getAllOrders({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      status,
      search,
    });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

/**
 * Get revenue transactions
 * @route   GET /api/admin/revenue
 */
const getRevenue = async (req, res, next) => {
  try {
    const { limit, offset } = req.query;
    const transactions = await repositories.admin.getRevenueTransactions({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    res.status(200).json({ success: true, transactions, total });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all driver verifications
 * @route   GET /api/admin/driver-verifications
 */
const getDriverVerifications = async (req, res, next) => {
  try {
    const drivers = await repositories.admin.getDriverVerifications();
    res.status(200).json({ success: true, drivers });
  } catch (error) {
    next(error);
  }
};

/**
 * Get driver verification details
 * @route   GET /api/admin/driver-verifications/:id
 */
const getDriverVerificationDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const driver = await repositories.admin.getDriverVerificationDetails(id);
    if (!driver) return res.status(404).json({ success: false, error: 'Driver not found' });
    res.status(200).json({ success: true, driver });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve driver verification
 * @route   PUT /api/admin/driver-verifications/:id/approve
 */
const approveDriverVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const driver = await repositories.admin.approveDriver(id);
    res.status(200).json({ success: true, message: 'Driver approved successfully', driver });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject driver verification
 * @route   PUT /api/admin/driver-verifications/:id/reject
 */
const rejectDriverVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'Reason is required' });
    const driver = await repositories.admin.rejectDriver(id, reason);
    res.status(200).json({ success: true, message: 'Driver rejected successfully', driver });
  } catch (error) {
    next(error);
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
  getEntityHistory,
  getAllPayouts,
  updatePayoutStatus,
  getAllOrders,
  getRevenue,
  getDriverVerifications,
  getDriverVerificationDetails,
  approveDriverVerification,
  rejectDriverVerification,
};
