const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getBalance, getLoyaltyTransactions, dailyCheckin } = require('../controllers/loyaltyController');

/**
 * @swagger
 * /api/v1/loyalty/balance:
 *   get:
 *     summary: Get loyalty points balance
 *     description: Returns the authenticated user's current loyalty points balance.
 *     tags: [Loyalty]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   description: Current loyalty points balance
 *                   example: 1250
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/balance', protect, getBalance);

/**
 * @swagger
 * /api/v1/loyalty/transactions:
 *   get:
 *     summary: Get loyalty transaction history
 *     description: Returns a paginated list of the authenticated user's loyalty point transactions.
 *     tags: [Loyalty]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of transactions to return per page
 *     responses:
 *       200:
 *         description: Loyalty transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       points:
 *                         type: number
 *                       type:
 *                         type: string
 *                         example: earned
 *                       description:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.get('/transactions', protect, getLoyaltyTransactions);

/**
 * @swagger
 * /api/v1/loyalty/check-in:
 *   post:
 *     summary: Record today's daily check-in
 *     description: Awards loyalty points for opening the app. Streak continues if the user checked in yesterday; every 7th consecutive day earns a bonus. Idempotent per day.
 *     tags: [Loyalty]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Check-in recorded (or already checked in today)
 */
router.post('/check-in', protect, dailyCheckin);

module.exports = router;
