// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { initializePayment, verifyPayment, handleWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Public webhook
router.post('/webhook', handleWebhook);

// Protected routes
router.use(protect);
router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);

module.exports = router;
