// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { initializePayment, verifyPayment, handleWebhook, chargeAuthorization, initializeListingFee } = require('../controllers/paymentController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const { validateInitializePayment } = require('../middleware/validators');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Paystack webhook — must be public, raw JSON body for HMAC verification
router.post('/webhook', handleWebhook);

// Protected routes
router.use(protect);
router.use(paymentLimiter);
router.post('/initialize', validateInitializePayment, initializePayment);
router.post('/listing-fee/initialize', hasAnyRole('seller', 'admin'), initializeListingFee);
router.get('/verify/:reference', verifyPayment);
// Only buyers (or admins in exceptional cases) should trigger a card charge
router.post('/charge', hasAnyRole('buyer', 'admin'), chargeAuthorization);

module.exports = router;
