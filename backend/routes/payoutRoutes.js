// routes/payoutRoutes.js
const express = require('express');
const router = express.Router();
const { requestPayout, getPayoutHistory, processPayout } = require('../controllers/payoutController');
const { protect, seller, admin } = require('../middleware/authMiddleware');
const { validateRequestPayout } = require('../middleware/validators');
const requireDisclaimer = require('../middleware/requireDisclaimer');

router.use(protect);

// @route   POST /api/payouts/request
// @access  Seller
/**
 * @swagger
 * /api/v1/payouts/request:
 *   post:
 *     summary: Request a payout
 *     description: Allows a seller to submit a payout request for a specific store.
 *     tags: [Payouts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeId
 *               - amount
 *               - bankAccount
 *             properties:
 *               storeId:
 *                 type: string
 *                 description: The ID of the store requesting the payout.
 *                 example: "store_abc123"
 *               amount:
 *                 type: number
 *                 description: The payout amount requested.
 *                 example: 250.00
 *               bankAccount:
 *                 type: object
 *                 required:
 *                   - accountNumber
 *                   - bankCode
 *                 properties:
 *                   accountNumber:
 *                     type: string
 *                     description: The seller's bank account number.
 *                     example: "1234567890"
 *                   bankCode:
 *                     type: string
 *                     description: The bank's routing/sort code.
 *                     example: "044"
 *     responses:
 *       200:
 *         description: Payout request submitted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Payout request submitted successfully.
 *       400:
 *         description: Validation error or bad request.
 *       401:
 *         description: Unauthorized — missing or invalid token.
 *       403:
 *         description: Forbidden — seller role required.
 */
router.post('/request', seller, requireDisclaimer('payout_terms'), validateRequestPayout, requestPayout);

// @route   GET /api/payouts/history/:storeId
// @access  Seller
/**
 * @swagger
 * /api/v1/payouts/history/{storeId}:
 *   get:
 *     summary: Get payout history for a store
 *     description: Returns the full payout history for the specified store. Accessible by sellers only.
 *     tags: [Payouts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the store whose payout history is being retrieved.
 *         example: "store_abc123"
 *     responses:
 *       200:
 *         description: Payout history retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 payouts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       payoutId:
 *                         type: string
 *                         example: "payout_xyz789"
 *                       amount:
 *                         type: number
 *                         example: 250.00
 *                       status:
 *                         type: string
 *                         example: "processed"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-06-01T10:00:00Z"
 *       401:
 *         description: Unauthorized — missing or invalid token.
 *       403:
 *         description: Forbidden — seller role required.
 *       404:
 *         description: Store not found.
 */
router.get('/history/:storeId', seller, getPayoutHistory);

// @route   PUT /api/payouts/:payoutId/process
// @access  Admin
/**
 * @swagger
 * /api/v1/payouts/{payoutId}/process:
 *   put:
 *     summary: Process a payout request
 *     description: Allows an admin to approve or reject a pending payout and attach a transaction ID.
 *     tags: [Payouts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the payout to process.
 *         example: "payout_xyz789"
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
 *                 enum: [approved, rejected]
 *                 description: The new status to apply to the payout.
 *                 example: "approved"
 *               transactionId:
 *                 type: string
 *                 description: The external transaction reference ID (required when approving).
 *                 example: "txn_0987654321"
 *     responses:
 *       200:
 *         description: Payout processed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Payout approved successfully.
 *       400:
 *         description: Validation error or bad request.
 *       401:
 *         description: Unauthorized — missing or invalid token.
 *       403:
 *         description: Forbidden — admin role required.
 *       404:
 *         description: Payout not found.
 */
router.put('/:payoutId/process', admin, processPayout);

module.exports = router;
