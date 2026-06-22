// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { initializePayment, verifyPayment, handleWebhook, chargeAuthorization, initializeListingFee } = require('../controllers/paymentController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const { validateInitializePayment } = require('../middleware/validators');
const { paymentLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * /api/v1/payments/webhook:
 *   post:
 *     summary: Receive Paystack webhook events
 *     description: Public endpoint that accepts raw JSON from Paystack for HMAC signature verification. Do not pass an Authorization header.
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - data
 *             properties:
 *               event:
 *                 type: string
 *                 example: charge.success
 *               data:
 *                 type: object
 *                 description: Event payload as sent by Paystack
 *     responses:
 *       200:
 *         description: Webhook received and acknowledged
 *       400:
 *         description: Invalid signature or malformed payload
 */
// Paystack webhook — must be public, raw JSON body for HMAC verification
router.post('/webhook', handleWebhook);

// Protected routes
router.use(protect);
router.use(paymentLimiter);

/**
 * @swagger
 * /api/v1/payments/initialize:
 *   post:
 *     summary: Initialize a payment transaction
 *     description: Creates a new Paystack transaction for an order and returns an authorization URL.
 *     tags: [Payments]
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
 *               - amount
 *               - email
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: UUID of the order being paid for
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               amount:
 *                 type: number
 *                 description: Amount in the smallest currency unit (e.g. kobo for NGN)
 *                 example: 150000
 *               email:
 *                 type: string
 *                 format: email
 *                 example: buyer@example.com
 *               callbackUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL Paystack redirects to after payment
 *                 example: "https://shopyos.app/payment/verify"
 *     responses:
 *       200:
 *         description: Payment initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 authorizationUrl:
 *                   type: string
 *                 accessCode:
 *                   type: string
 *                 reference:
 *                   type: string
 *       400:
 *         description: Validation error or Paystack initialization failure
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 */
const requireDisclaimer = require('../middleware/requireDisclaimer');

router.post('/initialize', requireDisclaimer('refund_policy'), validateInitializePayment, initializePayment);

/**
 * @swagger
 * /api/v1/payments/listing-fee/initialize:
 *   post:
 *     summary: Initialize a product listing fee payment
 *     description: Starts a Paystack transaction to cover the listing fee for a product. Restricted to sellers and admins.
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *                 description: UUID of the product whose listing fee is being paid
 *                 example: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
 *     responses:
 *       200:
 *         description: Listing fee payment initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 authorizationUrl:
 *                   type: string
 *                 reference:
 *                   type: string
 *       400:
 *         description: Invalid product ID or Paystack error
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 *       403:
 *         description: Forbidden — caller is not a seller or admin
 */
router.post('/listing-fee/initialize', hasAnyRole('seller', 'admin'), initializeListingFee);

/**
 * @swagger
 * /api/v1/payments/verify/{reference}:
 *   get:
 *     summary: Verify a payment transaction
 *     description: Queries Paystack to confirm the status of a transaction by its reference and updates the related order.
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Paystack transaction reference returned during initialization
 *         example: "txref_abc123xyz"
 *     responses:
 *       200:
 *         description: Payment verification result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   description: Paystack transaction object
 *       400:
 *         description: Reference not found or verification failed
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 */
router.get('/verify/:reference', verifyPayment);

/**
 * @swagger
 * /api/v1/payments/charge:
 *   post:
 *     summary: Charge a returning customer using a saved authorization
 *     description: Performs a recurring charge against a previously stored Paystack authorization code. The controller validates that the order belongs to the authenticated user.
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - authorizationCode
 *               - email
 *               - amount
 *               - orderId
 *             properties:
 *               authorizationCode:
 *                 type: string
 *                 description: Reusable authorization code from a previous Paystack transaction
 *                 example: "AUTH_8dfhjY"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: buyer@example.com
 *               amount:
 *                 type: number
 *                 description: Amount in the smallest currency unit (e.g. kobo for NGN)
 *                 example: 150000
 *               orderId:
 *                 type: string
 *                 description: UUID of the order being charged
 *                 example: "c3d4e5f6-a7b8-9012-cdef-123456789012"
 *     responses:
 *       200:
 *         description: Charge successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Charge failed or invalid payload
 *       401:
 *         description: Unauthorized — missing or invalid Bearer token
 */
// Any authenticated user can charge — controller validates order.buyer_id === req.user.id
router.post('/charge', chargeAuthorization);

module.exports = router;
