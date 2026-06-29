// controllers/returnController.js
// Full return & refund flow: buyer creates request, seller responds, admin resolves.

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');
const { logger } = require('../config/logger');

// Lock/unlock the balance_log entry for the order tied to a return
async function setBalanceLogEligibility(orderId, eligibleAt) {
    try {
        const db = require('../config/postgres').getPool();
        await db.query(
            `UPDATE balance_logs SET payout_eligible_at = $1 WHERE order_id = $2 AND transaction_type = 'sale'`,
            [eligibleAt, orderId]
        );
    } catch (err) {
        logger.warn('[Return] setBalanceLogEligibility failed:', err.message);
    }
}

// â”€â”€â”€ Buyer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// @route   POST /api/v1/returns
// @desc    Buyer submits a return request
// @access  Private (Buyer)
const createReturnRequest = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { orderId, reason, reasonCategory, evidenceImages = [] } = req.body;

    if (!orderId || !reason?.trim()) {
      return ApiResponse.error(res, 'orderId and reason are required', 400);
    }

    const order = await repositories.orders.findById(orderId);
    if (!order || order.buyer_id !== buyerId) {
      return ApiResponse.error(res, 'Order not found', 404);
    }
    if (!['delivered', 'completed'].includes(order.status)) {
      return ApiResponse.error(res, 'Returns can only be requested for delivered orders', 400);
    }

    // Prevent duplicate open requests for the same order
    const open = await repositories.returns.getOpenByOrderId(orderId);
    if (open) {
      return ApiResponse.error(res, 'A return request is already open for this order', 400);
    }

    const sellerId = order.seller_id || order.store?.owner_id;
    if (!sellerId) {
      return ApiResponse.error(res, 'Could not determine seller for this order', 400);
    }

    const subtotal = Number.parseFloat(order.subtotal || 0);
    const discount = Number.parseFloat(order.discount_amount || 0);
    const refundableAmount = Math.max(0, subtotal - discount);

    const returnReq = await repositories.returns.create({
      order_id: orderId,
      buyer_id: buyerId,
      seller_id: sellerId,
      reason: reason.trim(),
      reason_category: reasonCategory || 'other',
      evidence_images: evidenceImages.length ? evidenceImages : null,
      delivery_fee_at_time: order.delivery_fee,
      refundable_amount: refundableAmount,
      policy_version: '1.0',
      disclaimer_acknowledged: true,
      acknowledged_at: new Date().toISOString()
    });

    // Lock the seller's balance entry for this order while return is open
    await setBalanceLogEligibility(orderId, null);

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

    return ApiResponse.created(res, returnReq);
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
    const limitNum = Math.min(Number.parseInt(limit) || 20, 100);
    const offset = (Math.max(Number.parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.returns.getBuyerReturns(req.user.id, { limit: limitNum, offset });
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    ApiResponse.paginated(res, data, { page: currentPage, limit: limitNum, total: count, pages: totalPages });
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ Seller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// @route   GET /api/v1/returns/seller
// @desc    Seller lists return requests for their store
// @access  Private (Seller)
const getSellerReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(Number.parseInt(limit) || 20, 100);
    const offset = (Math.max(Number.parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.returns.getSellerReturns(
      req.user.id,
      status || null,
      { limit: limitNum, offset }
    );
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    ApiResponse.paginated(res, data, { page: currentPage, limit: limitNum, total: count, pages: totalPages });
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
      return ApiResponse.error(res, "action must be 'approve' or 'decline'", 400);
    }

    const returnReq = await repositories.returns.findById(returnId);
    if (!returnReq || returnReq.seller_id !== sellerId) {
      return ApiResponse.error(res, 'Return request not found', 404);
    }
    if (returnReq.status !== 'pending') {
      return ApiResponse.error(res, 'This request has already been actioned', 400);
    }

    const newStatus = action === 'approve' ? 'seller_approved' : 'seller_declined';
    const updated = await repositories.returns.update(returnId, {
      status: newStatus,
      seller_response: sellerResponse?.trim() || null
    });

    // Seller declined → unlock balance immediately (return won't proceed)
    if (newStatus === 'seller_declined') {
      await setBalanceLogEligibility(returnReq.order_id, new Date().toISOString());
    }

    const notificationType = action === 'approve' ? 'return_approved' : 'return_declined';
    const notificationTitle = action === 'approve' ? 'Return approved' : 'Return declined';
    const declineReason = sellerResponse ? ` Reason: ${sellerResponse}` : '';
    const notificationMessage = action === 'approve'
      ? 'Your return request has been approved. A refund will be processed shortly.'
      : `Your return request was declined.${declineReason}`;
    await notificationService.sendNotification({
      userId: returnReq.buyer_id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      relatedId: returnId,
      relatedType: 'return_request',
      push: { data: { screen: `order/${returnReq.order_id}` } }
    }).catch(e => logger.warn('[Return] buyer notify failed:', e.message));

    ApiResponse.success(res, updated);
  } catch (err) {
    next(err);
  }
};

// â”€â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// @route   GET /api/v1/returns/admin
// @desc    Admin lists all return requests
// @access  Private (Admin)
const getAdminReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const limitNum = Math.min(Number.parseInt(limit) || 20, 100);
    const offset = (Math.max(Number.parseInt(page) || 1, 1) - 1) * limitNum;

    const { data, count } = await repositories.returns.getAdminReturns(
      status || null,
      { limit: limitNum, offset }
    );
    const totalPages = Math.ceil(count / limitNum);
    const currentPage = Math.floor(offset / limitNum) + 1;

    ApiResponse.paginated(res, data, { page: currentPage, limit: limitNum, total: count, pages: totalPages });
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
      return ApiResponse.error(res, `action must be one of: ${validActions.join(', ')}`, 400);
    }

    const returnReq = await repositories.returns.findById(returnId);
    if (!returnReq) {
      return ApiResponse.error(res, 'Return request not found', 404);
    }

    const statusMap = { refund: 'refund_issued', escalate: 'admin_review', close: 'closed' };
    const newStatus = statusMap[action];
    const isResolved = ['refund_issued', 'closed'].includes(newStatus);

    if (action === 'refund') {
      if (refundAmount === undefined || refundAmount === null || Number.parseFloat(refundAmount) <= 0) {
        return ApiResponse.error(res, 'Valid refundAmount is required', 400);
      }
      const maxRefund = Number.parseFloat(returnReq.refundable_amount || 0);
      if (Number.parseFloat(refundAmount) > maxRefund) {
        return ApiResponse.error(res, `Refund amount cannot exceed the maximum refundable product amount of GHS ${maxRefund}`, 400);
      }
    }

    const updated = await repositories.returns.update(returnId, {
      status: newStatus,
      admin_notes: adminNotes?.trim() || null,
      refund_amount: refundAmount ? Number.parseFloat(refundAmount) : null,
      resolved_at: isResolved ? new Date().toISOString() : null
    });

    if (newStatus === 'refund_issued') {
      // Deduct refund from seller balance and cancel the balance_log entry
      const db = require('../config/postgres').getPool();
      await db.query(
          `UPDATE balance_logs SET payout_eligible_at = NULL, notes = 'Refund issued — balance cancelled'
           WHERE order_id = $1 AND transaction_type = 'sale'`,
          [returnReq.order_id]
      ).catch(e => logger.warn('[Return] cancel balance_log failed:', e.message));

      // Deduct from store balance
      const store = await repositories.stores.findById(updated.order?.store_id || null).catch(() => null);
      if (store) {
          const newBal = Math.max(0, Number.parseFloat(store.current_balance || 0) - Number.parseFloat(refundAmount));
          await repositories.stores.update(store.id, { current_balance: newBal }).catch(e =>
              logger.warn('[Return] deduct store balance failed:', e.message)
          );
      }

      await notificationService.sendNotification({
        userId: returnReq.buyer_id,
        type: 'refund_issued',
        title: 'Refund issued',
        message: `₵${refundAmount} has been refunded for your return request.`,
        relatedId: returnId,
        relatedType: 'return_request',
        push: { data: { screen: `order/${returnReq.order_id}` } }
      }).catch(e => logger.warn('[Return] refund notify failed:', e.message));
    } else if (newStatus === 'closed') {
      // Return closed without refund — unlock seller balance immediately
      await setBalanceLogEligibility(returnReq.order_id, new Date().toISOString());
    }
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
