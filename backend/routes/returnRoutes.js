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
 *               - items
 *               - reason
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID of the order being returned
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: ID of the product to return
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       description: Quantity of the product to return
 *               reason:
 *                 type: string
 *                 description: Reason for the return
 *               description:
 *                 type: string
 *                 description: Additional description for the return request
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 description: New status for the return request
 *               message:
 *                 type: string
 *                 description: Seller's response message to the buyer
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
