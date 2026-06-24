const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { validatePromoCode } = require('../controllers/promoController');

/**
 * @swagger
 * /api/v1/promo/validate:
 *   post:
 *     summary: Validate a promo code
 *     description: Validates a promotional code against the current cart total and returns discount details if valid.
 *     tags: [Promo]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - cartTotal
 *             properties:
 *               code:
 *                 type: string
 *                 description: The promotional code to validate
 *                 example: SAVE20
 *               cartTotal:
 *                 type: number
 *                 description: The current cart total in the smallest currency unit
 *                 example: 5000
 *     responses:
 *       200:
 *         description: Promo code is valid — discount details returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 discountAmount:
 *                   type: number
 *                   example: 1000
 *                 discountType:
 *                   type: string
 *                   example: percentage
 *       400:
 *         description: Invalid or expired promo code
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
router.post('/validate', protect, validatePromoCode);

module.exports = router;
