const express = require('express');
const router = express.Router();
const { protect, seller: isSeller, admin: isAdmin } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');
const {
  createReturnRequest,
  getBuyerReturns,
  getSellerReturns,
  sellerRespondToReturn,
  getAdminReturns,
  adminActOnReturn
} = require('../controllers/returnController');

// Buyer

/**
 * @swagger
 * /api/v1/returns:
 *   post:
 *     summary: Create a return request
 *     tags: [Returns]
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
 *               - reason
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID of the order being returned
 *               reason:
 *                 type: string
 *                 description: Reason for the return
 *               reasonCategory:
 *                 type: string
 *                 description: Category of the reason (e.g. defective, wrong_item, size_fit)
 *               evidenceImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Up to 3 evidence photo URLs
 *               resolutionType:
 *                 type: string
 *                 enum: [refund, replacement]
 *                 default: refund
 *                 description: Whether the buyer wants a refund or a replacement (different variant of the same product)
 *               orderItemId:
 *                 type: string
 *                 description: Required when resolutionType is 'replacement' — the order_items row being returned
 *               targetVariantId:
 *                 type: string
 *                 description: Required when resolutionType is 'replacement' — the product_variants row (same product, different size/color) to send instead
 *     responses:
 *       200:
 *         description: Return request created successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Order not found
 */
router.post('/', protect, requireDisclaimer('refund_policy'), auditLog('request_return', 'order'), createReturnRequest);

/**
 * @swagger
 * /api/v1/returns/my:
 *   get:
 *     summary: Get the authenticated buyer's return requests
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of the buyer's return requests
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/my', protect, getBuyerReturns);

// Seller

/**
 * @swagger
 * /api/v1/returns/seller:
 *   get:
 *     summary: Get return requests for the authenticated seller's products
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of return requests for the seller's products
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 */
router.get('/seller', protect, isSeller, getSellerReturns);

/**
 * @swagger
 * /api/v1/returns/{returnId}/respond:
 *   patch:
 *     summary: Seller responds to a return request
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: returnId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the return request to respond to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, decline, ship, deliver]
 *                 description: approve/decline apply to a pending request; ship/deliver apply only to an approved replacement's shipping lifecycle
 *               sellerResponse:
 *                 type: string
 *                 description: Seller's response message to the buyer (approve/decline)
 *               trackingInfo:
 *                 type: string
 *                 description: Optional free-text shipping note when marking a replacement as shipped
 *     responses:
 *       200:
 *         description: Return request updated successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller role required
 *       404:
 *         description: Return request not found
 */
router.patch('/:returnId/respond', protect, isSeller, sellerRespondToReturn);

// Admin

/**
 * @swagger
 * /api/v1/returns/admin:
 *   get:
 *     summary: Get all return requests (admin)
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of all return requests
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/admin', protect, isAdmin, getAdminReturns);

/**
 * @swagger
 * /api/v1/returns/{returnId}/admin:
 *   patch:
 *     summary: Admin takes action on a return request
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: returnId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the return request to act on
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
 *                 description: New status to set for the return request
 *               refundAmount:
 *                 type: number
 *                 format: float
 *                 description: Refund amount to issue to the buyer
 *     responses:
 *       200:
 *         description: Return request updated successfully
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Return request not found
 */
router.patch('/:returnId/admin', protect, isAdmin, adminActOnReturn);

module.exports = router;
