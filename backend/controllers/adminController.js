// controllers/adminController.js
// Admin controller for user management, store verification, and platform analytics

const repositories = require('../db/repositories');
const { logger } = require('../config/logger');
const notificationService = require('../services/notificationService');
const rabbitMQService = require('../services/rabbitmq');

/**
 * Get dashboard analytics
 * @route   GET /api/admin/dashboard
 * @access  Admin
 */
const getDashboard = async (req, res, next) => {
  try {
    const { getPool } = require('../config/postgres');
    const db = getPool();

    const { rows } = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL)           AS total_users,
        (SELECT COUNT(*)::int FROM stores)                                    AS total_stores,
        (SELECT COUNT(*)::int FROM orders)                                    AS total_orders,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') AS total_revenue,
        (SELECT COUNT(*)::int FROM driver_profiles WHERE is_verified = FALSE
          AND rejection_reason IS NULL)                                       AS pending_driver_verifications
    `);

    const s = rows[0] || {};

    res.status(200).json({
      success: true,
      stats: {
        totalUsers: s.total_users || 0,
        totalStores: s.total_stores || 0,
        totalOrders: s.total_orders || 0,
        totalRevenue: Number.parseFloat(s.total_revenue) || 0,
        pendingPayouts: 0,
        activePromotions: 0,
        pendingDriverVerifications: s.pending_driver_verifications || 0,
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
      limit: Number.parseInt(limit) || 50,
      offset: Number.parseInt(offset) || 0,
      role,
      accountStatus,
      search
    });

    res.status(200).json({
      success: true,
      users,
      pagination: {
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user statistics (platform-wide counts)
 * @route   GET /api/admin/users/stats
 * @access  Admin
 */
const getUserStats = async (req, res, next) => {
  try {
    const stats = await repositories.admin.getUserStats();
    res.status(200).json({ success: true, stats });
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
      limit: Number.parseInt(limit) || 50,
      offset: Number.parseInt(offset) || 0,
      verificationStatus,
      search,
      id
    });

    res.status(200).json({
      success: true,
      stores,
      pagination: {
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0
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

    // 1. Fetch current store details to check for documents
    const currentStore = await repositories.stores.findById(storeId);

    // 2. Determine trusted status (only if verified)
    let isTrusted = false;
    if (status === 'verified' && currentStore) {
      isTrusted = !!(
        currentStore.business_cert_url ||
        currentStore.business_license_url ||
        currentStore.proof_of_bank_url
      );
    }

    const store = await repositories.admin.updateStoreVerification(storeId, status, reason);

    // Sync the is_verified boolean and set is_trusted
    await repositories.stores.update(storeId, {
      is_verified: status === 'verified',
      is_trusted: isTrusted
    });

    // Notify business owner when admin approves verification
    const ownerId = store?.owner_id || currentStore?.owner_id;
    if (ownerId) {
      if (status === 'verified') {
        await notificationService.sendNotification({
          userId: ownerId,
          type: 'business_approved',
          title: 'Business Approved',
          message: `${store?.store_name || currentStore?.store_name || 'Your business'} has been approved by admin.`,
          relatedId: storeId,
          relatedType: 'store',
          data: {
            storeId,
            status: 'verified'
          },
          push: {
            data: {
              screen: 'business/dashboard',
              storeId
            }
          }
        });
      }

      const ownerUser = await repositories.users.findById(ownerId);
      const ownerProfile = await repositories.userProfiles.findByUserId(ownerId);
      if (ownerUser?.email && (status === 'verified' || status === 'rejected')) {
        rabbitMQService.publishMessage('email', {
          eventType: 'BUSINESS_VERIFICATION_RESULT',
          userId: ownerId,
          role: 'seller',
          email: ownerUser.email,
          referenceId: storeId,
          templateData: {
            businessName: store?.store_name || currentStore?.store_name || 'Your business',
            ownerName: ownerProfile?.full_name || 'Business Owner',
            status,
            reason: reason || ''
          }
        });
      }
    }

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id,
      action: 'verify_store',
      entityType: 'store',
      entityId: storeId,
      changes: { verification_status: status, is_trusted: isTrusted, reason },
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
      limit: Number.parseInt(limit) || 50,
      offset: Number.parseInt(offset) || 0
    });

    res.status(200).json({
      success: true,
      reports,
      pagination: {
        limit: Number.parseInt(limit) || 50,
        offset: Number.parseInt(offset) || 0
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
      limit: Number.parseInt(limit) || 100,
      offset: Number.parseInt(offset) || 0
    });

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        limit: Number.parseInt(limit) || 100,
        offset: Number.parseInt(offset) || 0
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
      limit: Number.parseInt(limit) || 50,
      offset: Number.parseInt(offset) || 0
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
      limit: Number.parseInt(limit) || 50,
      offset: Number.parseInt(offset) || 0,
      status,
      search,
    });
    res.status(200).json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all escrow funds
 * @route   GET /api/admin/escrows
 */
const getAllEscrows = async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;

    let query = repositories.orders.db.from('orders')
      .select('id, order_number, total_amount, platform_fee, seller_payout_amount, escrow_status, updated_at, buyer_id, store_id')
      .neq('escrow_status', 'PENDING');

    if (status) query = query.eq('escrow_status', status);

    query = query
      .order('updated_at', { ascending: false })
      .range(Number.parseInt(offset) || 0, (Number.parseInt(offset) || 0) + (Number.parseInt(limit) || 50) - 1);

    const { data: escrows, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, escrows });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually refund escrow to buyer
 * @route   PUT /api/admin/escrows/:id/refund
 */
const refundEscrow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await repositories.orders.findById(id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.escrow_status !== 'HELD' && order.escrow_status !== 'DISPUTED') {
      return res.status(400).json({ success: false, error: 'Order is not in an escrow holding state' });
    }

    // For now, we update the status atomically so concurrent requests
    // cannot both transition the same order and create duplicate audit logs.
    const now = new Date().toISOString();
    const { data: updatedOrders, error } = await repositories.orders.db.from('orders')
      .update({ escrow_status: 'REFUNDED', status: 'refunded', updated_at: now })
      .eq('id', id)
      .in('escrow_status', ['HELD', 'DISPUTED'])
      .select('*');

    if (error) throw error;

    if (!updatedOrders || updatedOrders.length === 0) {
      return res.status(409).json({
        success: false,
        error: 'Order escrow status changed before the refund could be applied'
      });
    }

    const updatedOrder = updatedOrders[0];

    // Create audit log only after a successful guarded transition.
    await repositories.auditLogs.createLog({
      userId: req.user.id, action: 'refund_escrow', entityType: 'order', entityId: id,
      changes: { status: 'refunded', reason }, ipAddress: req.ip, userAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, message: 'Escrow refunded successfully', order: updatedOrder });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually release escrow to seller
 * @route   PUT /api/admin/escrows/:id/release
 */
const releaseEscrow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await repositories.orders.findById(id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.escrow_status !== 'HELD' && order.escrow_status !== 'DISPUTED') {
      return res.status(400).json({ success: false, error: 'Order is not in an escrow holding state' });
    }

    // Use the atomic delivery confirmation RPC for consistent fund release
    const { data: rpcResult, error: rpcError } = await repositories.orders.db.rpc('confirm_delivery_atomic', {
      p_order_id: id,
      p_user_id: req.user.id,
      p_is_admin: true
    });

    if (rpcError) throw rpcError;
    if (!rpcResult.success) {
      return res.status(400).json(rpcResult);
    }

    // Fetch updated order for response
    const updatedOrder = await repositories.orders.getOrderDetails(id);

    // Create audit log
    await repositories.auditLogs.createLog({
      userId: req.user.id, action: 'release_escrow', entityType: 'order', entityId: id,
      changes: { status: 'completed', reason }, ipAddress: req.ip, userAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, message: 'Escrow released successfully', order: updatedOrder });
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
      limit: Number.parseInt(limit) || 50,
      offset: Number.parseInt(offset) || 0,
    });
    const total = transactions.reduce((sum, t) => sum + Number.parseFloat(t.amount || 0), 0);
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

    if (driver?.user_id) {
      const user = await repositories.users.findById(driver.user_id);
      const profile = await repositories.userProfiles.findByUserId(driver.user_id);

      // Send standard push & in-app notification
      await notificationService.sendNotification({
        userId: driver.user_id,
        type: 'driver_approved',
        title: 'Driver Account Approved',
        message: 'Your driver account has been approved! You can now start accepting delivery requests.',
        relatedId: driver.id,
        relatedType: 'driver',
        data: {
          driverId: driver.id,
          status: 'verified'
        },
        push: {
          data: {
            screen: 'driver/dashboard',
            driverId: driver.id
          }
        }
      }).catch(err => logger.error('Failed to send driver approval notification:', err.message));

      if (user?.email) {
        rabbitMQService.publishMessage('email', {
          eventType: 'DRIVER_VERIFICATION_RESULT',
          userId: driver.user_id,
          role: 'driver',
          email: user.email,
          referenceId: driver.id,
          templateData: {
            driverName: profile?.full_name || 'Driver',
            status: 'approved'
          }
        });
      }
    }

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

    if (driver?.user_id) {
      const user = await repositories.users.findById(driver.user_id);
      const profile = await repositories.userProfiles.findByUserId(driver.user_id);

      // Send standard push & in-app notification
      await notificationService.sendNotification({
        userId: driver.user_id,
        type: 'driver_rejected',
        title: 'Driver Account Rejected',
        message: `Your driver account verification was rejected. Reason: ${reason}`,
        relatedId: driver.id,
        relatedType: 'driver',
        data: {
          driverId: driver.id,
          status: 'rejected',
          reason
        },
        push: {
          data: {
            screen: 'driver/verification',
            driverId: driver.id
          }
        }
      }).catch(err => logger.error('Failed to send driver rejection notification:', err.message));

      if (user?.email) {
        rabbitMQService.publishMessage('email', {
          eventType: 'DRIVER_VERIFICATION_RESULT',
          userId: driver.user_id,
          role: 'driver',
          email: user.email,
          referenceId: driver.id,
          templateData: {
            driverName: profile?.full_name || 'Driver',
            status: 'rejected',
            reason
          }
        });
      }
    }

    res.status(200).json({ success: true, message: 'Driver rejected successfully', driver });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getAllUsers,
  getUserStats,
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
  getAllEscrows,
  refundEscrow,
  releaseEscrow
};
