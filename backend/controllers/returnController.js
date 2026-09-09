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
    const {
      orderId, reason, reasonCategory, evidenceImages = [],
      resolutionType = 'refund', orderItemId, targetVariantId
    } = req.body;

    if (!orderId || !reason?.trim()) {
      return ApiResponse.error(res, 'orderId and reason are required', 400);
    }
    if (!['refund', 'replacement'].includes(resolutionType)) {
      return ApiResponse.error(res, "resolutionType must be 'refund' or 'replacement'", 400);
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

    let orderItem = null;
    let targetVariant = null;
    if (resolutionType === 'replacement') {
      if (!orderItemId || !targetVariantId) {
        return ApiResponse.error(res, 'orderItemId and targetVariantId are required for a replacement request', 400);
      }

      const db = require('../config/postgres').getPool();
      const { rows: orderItemRows } = await db.query(
        `SELECT * FROM order_items WHERE id = $1 AND order_id = $2`,
        [orderItemId, orderId]
      );
      orderItem = orderItemRows[0] || null;
      if (!orderItem) {
        return ApiResponse.error(res, 'orderItemId does not belong to this order', 400);
      }

      targetVariant = await repositories.productVariants.findWithProduct(targetVariantId);
      if (!targetVariant || targetVariant.product_id !== orderItem.product_id) {
        return ApiResponse.error(res, 'targetVariantId must be a variant of the ordered product', 400);
      }
      if (!targetVariant.is_active || Number(targetVariant.stock_quantity) <= 0) {
        return ApiResponse.error(res, 'The selected replacement option is currently out of stock', 400);
      }
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
      resolution_type: resolutionType,
      order_item_id: resolutionType === 'replacement' ? orderItemId : null,
      target_variant_id: resolutionType === 'replacement' ? targetVariantId : null,
      policy_version: '1.0',
      disclaimer_acknowledged: true,
      acknowledged_at: new Date().toISOString()
    });

    // Lock the seller's balance entry for this order while return is open
    await setBalanceLogEligibility(orderId, null);

    // Notify seller
    const isReplacement = resolutionType === 'replacement';
    await notificationService.sendNotification({
      userId: sellerId,
      type: isReplacement ? 'replacement_requested' : 'return_requested',
      title: isReplacement ? 'New replacement request' : 'New return request',
      message: isReplacement
        ? `A buyer has requested a replacement item for order #${order.order_number}.`
        : `A buyer has requested a return for order #${order.order_number}.`,
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
    const { action, sellerResponse, trackingInfo } = req.body;
    const sellerId = req.user.id;

    const validActions = ['approve', 'decline', 'ship', 'deliver'];
    if (!validActions.includes(action)) {
      return ApiResponse.error(res, `action must be one of: ${validActions.join(', ')}`, 400);
    }

    const returnReq = await repositories.returns.findById(returnId);
    if (!returnReq || returnReq.seller_id !== sellerId) {
      return ApiResponse.error(res, 'Return request not found', 404);
    }

    const isReplacement = returnReq.resolution_type === 'replacement';

    // Preconditions: approve/decline act on a pending request; ship/deliver only
    // apply to an approved replacement moving through its shipping lifecycle.
    if (['approve', 'decline'].includes(action) && returnReq.status !== 'pending') {
      return ApiResponse.error(res, 'This request has already been actioned', 400);
    }
    if (action === 'ship' && (!isReplacement || returnReq.status !== 'replacement_approved')) {
      return ApiResponse.error(res, 'Only an approved replacement can be marked as shipped', 400);
    }
    if (action === 'deliver' && (!isReplacement || returnReq.status !== 'replacement_shipped')) {
      return ApiResponse.error(res, 'Only a shipped replacement can be marked as delivered', 400);
    }

    let newStatus;
    if (action === 'approve') newStatus = isReplacement ? 'replacement_approved' : 'seller_approved';
    else if (action === 'decline') newStatus = 'seller_declined';
    else if (action === 'ship') newStatus = 'replacement_shipped';
    else newStatus = 'replacement_delivered';

    const updateData = { status: newStatus };
    if (['approve', 'decline'].includes(action)) {
      updateData.seller_response = sellerResponse?.trim() || null;
    }
    if (action === 'ship') {
      updateData.replacement_shipped_at = new Date().toISOString();
      if (trackingInfo) updateData.replacement_tracking_info = trackingInfo.trim();
    }
    if (action === 'deliver') {
      updateData.replacement_delivered_at = new Date().toISOString();
      updateData.resolved_at = new Date().toISOString();
    }

    const updated = await repositories.returns.update(returnId, updateData);

    // Declined, or a fully-delivered replacement → unlock balance (no refund follows)
    if (newStatus === 'seller_declined' || newStatus === 'replacement_delivered') {
      await setBalanceLogEligibility(returnReq.order_id, new Date().toISOString());
    }

    const NOTICES = {
      approve: isReplacement
        ? { type: 'replacement_approved', title: 'Replacement approved', message: 'Your replacement request has been approved. The seller will ship your item shortly.' }
        : { type: 'return_approved', title: 'Return approved', message: 'Your return request has been approved. A refund will be processed shortly.' },
      decline: { type: isReplacement ? 'replacement_declined' : 'return_declined', title: isReplacement ? 'Replacement declined' : 'Return declined', message: `Your ${isReplacement ? 'replacement' : 'return'} request was declined.${sellerResponse ? ` Reason: ${sellerResponse}` : ''}` },
      ship: { type: 'replacement_shipped', title: 'Replacement shipped', message: 'Your replacement item is on its way.' },
      deliver: { type: 'replacement_delivered', title: 'Replacement delivered', message: 'Your replacement item has been marked as delivered.' }
    };
    const notice = NOTICES[action];
    await notificationService.sendNotification({
      userId: returnReq.buyer_id,
      type: notice.type,
      title: notice.title,
      message: notice.message,
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
      const amount = Number.parseFloat(refundAmount);
      const db = require('../config/postgres').getPool();

      // Cancel the balance_log entry — payout is no longer pending release for this order.
      await db.query(
          `UPDATE balance_logs SET payout_eligible_at = NULL, notes = 'Refund issued — balance cancelled'
           WHERE order_id = $1 AND transaction_type = 'sale'`,
          [returnReq.order_id]
      ).catch(e => logger.warn('[Return] cancel balance_log failed:', e.message));

      // Draw from the buyer protection reserve first — the fee collected at
      // checkout exists to fund exactly this, so the seller's own payout is
      // left untouched whenever the reserve can cover it. Only the shortfall
      // (if the reserve can't fully cover it) is clawed back from the seller.
      try {
        const { rows: reserveRows } = await db.query(`SELECT id, balance FROM platform_reserve LIMIT 1`);
        const reserve = reserveRows[0];
        const reserveBalance = Number.parseFloat(reserve?.balance || 0);
        const fromReserve = Number.parseFloat(Math.min(reserveBalance, amount).toFixed(2));
        const fromSeller = Number.parseFloat((amount - fromReserve).toFixed(2));

        if (fromReserve > 0 && reserve) {
          const newReserveBalance = Number.parseFloat((reserveBalance - fromReserve).toFixed(2));
          await db.query(
            `UPDATE platform_reserve SET balance = $1, updated_at = NOW() WHERE id = $2`,
            [newReserveBalance, reserve.id]
          );
          await db.query(
            `INSERT INTO reserve_logs (amount, transaction_type, order_id, return_request_id, balance_after, notes)
             VALUES ($1, 'refund_payout', $2, $3, $4, 'Refund drawn from buyer protection reserve')`,
            [-fromReserve, returnReq.order_id, returnId, newReserveBalance]
          );
        }

        if (fromSeller > 0) {
          const order = await repositories.orders.findById(returnReq.order_id).catch(() => null);
          const store = order?.store_id ? await repositories.stores.findById(order.store_id).catch(() => null) : null;
          if (store) {
            const newBal = Number.parseFloat((Number.parseFloat(store.current_balance || 0) - fromSeller).toFixed(2));
            await repositories.stores.update(store.id, { current_balance: newBal }).catch(e =>
                logger.warn('[Return] deduct store balance failed:', e.message)
            );
            await db.query(
              `INSERT INTO balance_logs (store_id, amount, transaction_type, order_id, balance_after, notes)
               VALUES ($1, $2, 'refund', $3, $4, 'Refund shortfall clawed back — reserve depleted')`,
              [store.id, -fromSeller, returnReq.order_id, newBal]
            ).catch(e => logger.warn('[Return] refund balance_log failed:', e.message));
          }
        }
      } catch (e) {
        logger.error('[Return] reserve/clawback refund failed:', e.message);
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

    ApiResponse.success(res, updated);
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
