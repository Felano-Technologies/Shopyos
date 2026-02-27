// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { initializePayment, verifyPayment, handleWebhook, chargeAuthorization } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Paystack webhook — must be public, raw JSON body for HMAC verification
router.post('/webhook', handleWebhook);

// Protected routes
router.use(protect);
router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);
router.post('/charge', chargeAuthorization);

module.exports = router;
