// routes/promoCodeRoutes.js
// Seller & admin promo code creation/management.
// Buyer-side redemption stays on routes/promoRoutes.js (/api/v1/promo/validate).

const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const {
  sellerCreatePromoCode,
  getSellerPromoCodes,
  adminCreatePromoCode,
  getAdminPromoCodes,
  deactivatePromoCode
} = require('../controllers/promoCodeController');

/**
 * @swagger
 * /api/v1/promo-codes:
 *   post:
 *     summary: Create a promo code for the seller's own store
 *     description: Creates a discount code scoped to the authenticated seller's store.
 *     tags: [PromoCodes]
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
 *               - type
 *               - value
 *             properties:
 *               code:
 *                 type: string
 *                 example: SAVE20
 *               type:
 *                 type: string
 *                 enum: [percentage, fixed]
 *               value:
 *                 type: number
 *               minOrder:
 *                 type: number
 *               maxUses:
 *                 type: integer
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Promo code created
 *       400:
 *         description: Validation error or duplicate code
 *       403:
 *         description: Seller store profile required
 */
router.post('/', protect, auditLog('create_promo_code', 'promo_code'), sellerCreatePromoCode);

/**
 * @swagger
 * /api/v1/promo-codes/my-codes:
 *   get:
 *     summary: List the authenticated seller's own promo codes
 *     tags: [PromoCodes]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of the seller's promo codes
 */
router.get('/my-codes', protect, getSellerPromoCodes);

/**
 * @swagger
 * /api/v1/promo-codes/admin:
 *   post:
 *     summary: Create a platform-wide promo code (admin only)
 *     tags: [PromoCodes]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Promo code created
 *   get:
 *     summary: List all promo codes for moderation (admin only)
 *     tags: [PromoCodes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: List of promo codes
 */
router.post('/admin', protect, admin, auditLog('create_promo_code', 'promo_code'), adminCreatePromoCode);
router.get('/admin', protect, admin, getAdminPromoCodes);

/**
 * @swagger
 * /api/v1/promo-codes/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a promo code
 *     description: The code's own seller, or an admin, can deactivate it. It is never hard-deleted since orders may reference it.
 *     tags: [PromoCodes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Promo code deactivated
 *       403:
 *         description: Not authorized to modify this promo code
 *       404:
 *         description: Promo code not found
 */
router.patch('/:id/deactivate', protect, auditLog('deactivate_promo_code', 'promo_code'), deactivatePromoCode);

module.exports = router;
