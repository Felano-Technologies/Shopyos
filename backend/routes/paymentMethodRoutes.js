// routes/paymentMethodRoutes.js
const express = require('express');
const router = express.Router();
const paymentMethodController = require('../controllers/paymentMethodController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

/**
 * @swagger
 * /api/v1/payment-methods:
 *   get:
 *     summary: Get all payment methods for the authenticated user
 *     tags: [Payment Methods]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', paymentMethodController.getPaymentMethods);

/**
 * @swagger
 * /api/v1/payment-methods:
 *   post:
 *     summary: Add a new payment method for the authenticated user
 *     tags: [Payment Methods]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - details
 *             properties:
 *               type:
 *                 type: string
 *                 description: Payment method type (e.g. card, mobile_money)
 *               details:
 *                 type: object
 *                 description: Payment method details (varies by type)
 *               isDefault:
 *                 type: boolean
 *                 description: Whether to set this as the default payment method
 *     responses:
 *       200:
 *         description: Payment method added successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', paymentMethodController.addPaymentMethod);

/**
 * @swagger
 * /api/v1/payment-methods/{id}:
 *   delete:
 *     summary: Delete a payment method by ID
 *     tags: [Payment Methods]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The payment method ID
 *     responses:
 *       200:
 *         description: Payment method deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment method not found
 */
router.delete('/:id', paymentMethodController.deletePaymentMethod);

/**
 * @swagger
 * /api/v1/payment-methods/{id}/default:
 *   put:
 *     summary: Set a payment method as the default
 *     tags: [Payment Methods]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The payment method ID
 *     responses:
 *       200:
 *         description: Default payment method updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment method not found
 */
router.put('/:id/default', paymentMethodController.setDefaultMethod);

module.exports = router;
