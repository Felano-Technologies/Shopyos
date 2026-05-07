// routes/deliveryFeeRoutes.js
// Delivery fee quote endpoint (used before checkout to show fee to buyer)

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDeliveryQuote } = require('../controllers/deliveryFeeController');

// @route   GET /api/v1/delivery/quote
// @desc    Get a delivery fee quote for a store given buyer coordinates
// @access  Private
// @query   storeId, buyerLat, buyerLng
router.get('/quote', protect, getDeliveryQuote);

module.exports = router;
