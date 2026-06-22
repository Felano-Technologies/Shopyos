// routes/deliveryFeeRoutes.js
// Delivery fee quote endpoint (used before checkout to show fee to buyer)

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDeliveryQuote } = require('../controllers/deliveryFeeController');

/**
 * @swagger
 * /api/v1/delivery/quote:
 *   get:
 *     summary: Get a delivery fee quote
 *     description: Returns an estimated delivery fee for a given store, delivery address, and cart total. Intended to be called before checkout to display the fee to the buyer.
 *     tags: [Delivery Fee]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the store fulfilling the order
 *       - in: query
 *         name: deliveryAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: The buyer's delivery address
 *         example: "14 Oxford Street, Accra, Ghana"
 *       - in: query
 *         name: cartTotal
 *         required: true
 *         schema:
 *           type: number
 *         description: The current cart total used to apply any fee thresholds or discounts
 *         example: 8500
 *     responses:
 *       200:
 *         description: Delivery fee quote retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fee:
 *                   type: number
 *                   description: Estimated delivery fee
 *                   example: 350
 *                 currency:
 *                   type: string
 *                   example: GHS
 *                 estimatedDeliveryTime:
 *                   type: string
 *                   example: 30-45 mins
 *       400:
 *         description: Missing or invalid query parameters
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Store not found
 */
// @route   GET /api/v1/delivery/quote
// @desc    Get a delivery fee quote for a store given buyer coordinates
// @access  Private
// @query   storeId, buyerLat, buyerLng
router.get('/quote', protect, getDeliveryQuote);

module.exports = router;
