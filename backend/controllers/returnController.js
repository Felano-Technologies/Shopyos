// controllers/returnController.js
// Full return & refund flow: buyer creates request, seller responds, admin resolves.

const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');
const { logger } = require('../config/logger');

// ─── Buyer ───────────────────────────────────────────────────────────────────

// @route   POST /api/v1/returns
// @desc    Buyer submits a return request
// @access  Private (Buyer)
const createReturnRequest = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { orderId, reason, reasonCategory, evidenceImages = [] } = req.body;

    if (!orderId || !reason?.trim()) {
      return res.status(400).json({ success: false, error: 'orderId and reason are required' });
    }

    const order = await repositories.orders.findById(orderId);
    if (!order || order.buyer_id !== buyerId) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ success: false, error: 'Returns can only be requested for delivered orders' });
    }

    // Prevent duplicate open requests for the same order
    const open = await repositories.returns.getOpenByOrderId(orderId);
    if (open) {
      return res.status(400).json({ success: false, error: 'A return request is already open for this order' });
    }

    const sellerId = order.seller_id || order.store?.owner_id;
    if (!sellerId) {
      return res.status(400).json({ success: false, error: 'Could not determine seller for this order' });
    }

    const returnReq = await repositories.returns.create({
      order_id: orderId,
      buyer_id: buyerId,
      seller_id: sellerId,
      reason: reason.trim(),
      reason_category: reasonCategory || 'other',
      evidence_images: evidenceImages.length ? evidenceImages : null
    });

    // Notify seller
    await notificationService.sendNotification({
      userId: sellerId,
      type: 'return_requested',
      title: 'New return request',
      message: `A buyer has requested a return for order #${order.order_number}.`,
      relatedId: returnReq.id,
      relatedType: 'return_request',
      push: { data: { screen: 'business/orders', returnId: returnReq.id } }
    }).catch(e => logger.warn('[Return] seller notify failed:', e.message));

    return res.status(201).json({ success: true, data: returnReq });
  } catch (err) {
    next(err);
  }
};

// @route   GET /api/v1/returns/my
// @desc    Buyer views their return requests
// @access  Private (Buyer)
const getBuyerReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.returns.getBuyerReturns(req.user.id, { limit: limitNum, offset });
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    res.json({
      success: true,
      data,
      pagination: { totalItems: count, totalPages, currentPage, itemsPerPage: limitNum, hasNext: currentPage < totalPages, hasPrev: currentPage > 1 }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Seller ──────────────────────────────────────────────────────────────────

// @route   GET /api/v1/returns/seller
// @desc    Seller lists return requests for their store
// @access  Private (Seller)
const getSellerReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.returns.getSellerReturns(
      req.user.id,
      status || null,
      { limit: limitNum, offset }
    );
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    res.json({
      success: true,
      data,
      pagination: { totalItems: count, totalPages, currentPage, itemsPerPage: limitNum, hasNext: currentPage < totalPages, hasPrev: currentPage > 1 }
    });
  } catch (err) {
    next(err);
  }
};

// @route   PATCH /api/v1/returns/:returnId/respond
// @desc    Seller approves or declines a return request
// @access  Private (Seller)
const sellerRespondToReturn = async (req, res, next) => {
  try {
    const { returnId } = req.params;
    const { action, sellerResponse } = req.body;
    const sellerId = req.user.id;

    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, error: "action must be 'approve' or 'decline'" });
    }

    const returnReq = await repositories.returns.findById(returnId);
    if (!returnReq || returnReq.seller_id !== sellerId) {
      return res.status(404).json({ success: false, error: 'Return request not found' });
    }
    if (returnReq.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'This request has already been actioned' });
    }

    const newStatus = action === 'approve' ? 'seller_approved' : 'seller_declined';
    const updated = await repositories.returns.update(returnId, {
      status: newStatus,
      seller_response: sellerResponse?.trim() || null
    });

    await notificationService.sendNotification({
      userId: returnReq.buyer_id,
      type: action === 'approve' ? 'return_approved' : 'return_declined',
      title: action === 'approve' ? 'Return approved' : 'Return declined',
      message: action === 'approve'
        ? 'Your return request has been approved. A refund will be processed shortly.'
        : `Your return request was declined.${sellerResponse ? ` Reason: ${sellerResponse}` : ''}`,
      relatedId: returnId,
      relatedType: 'return_request',
      push: { data: { screen: `order/${returnReq.order_id}` } }
    }).catch(e => logger.warn('[Return] buyer notify failed:', e.message));

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ─── Admin ───────────────────────────────────────────────────────────────────

// @route   GET /api/v1/returns/admin
// @desc    Admin lists all return requests
// @access  Private (Admin)
const getAdminReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.returns.getAdminReturns(
      status || null,
      { limit: limitNum, offset }
    );
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    res.json({
      success: true,
      data,
      pagination: { totalItems: count, totalPages, currentPage, itemsPerPage: limitNum, hasNext: currentPage < totalPages, hasPrev: currentPage > 1 }
    });
  } catch (err) {
    next(err);
  }
};

// @route   PATCH /api/v1/returns/:returnId/admin
// @desc    Admin issues refund, escalates, or closes a return
// @access  Private (Admin)
const adminActOnReturn = async (req, res, next) => {
  try {
    const { returnId } = req.params;
    const { action, adminNotes, refundAmount } = req.body;

    const validActions = ['refund', 'escalate', 'close'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, error: `action must be one of: ${validActions.join(', ')}` });
    }

    const returnReq = await repositories.returns.findById(returnId);
    if (!returnReq) {
      return res.status(404).json({ success: false, error: 'Return request not found' });
    }

    const statusMap = { refund: 'refund_issued', escalate: 'admin_review', close: 'closed' };
    const newStatus = statusMap[action];
    const isResolved = ['refund_issued', 'closed'].includes(newStatus);

    const updated = await repositories.returns.update(returnId, {
      status: newStatus,
      admin_notes: adminNotes?.trim() || null,
      refund_amount: refundAmount ? parseFloat(refundAmount) : null,
      resolved_at: isResolved ? new Date().toISOString() : null
    });

    if (newStatus === 'refund_issued') {
      await notificationService.sendNotification({
        userId: returnReq.buyer_id,
        type: 'refund_issued',
        title: 'Refund issued',
        message: `₵${refundAmount} has been refunded for your return request.`,
        relatedId: returnId,
        relatedType: 'return_request',
        push: { data: { screen: `order/${returnReq.order_id}` } }
      }).catch(e => logger.warn('[Return] refund notify failed:', e.message));
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createReturnRequest,
  getBuyerReturns,
  getSellerReturns,
  sellerRespondToReturn,
  getAdminReturns,
  adminActOnReturn
};
