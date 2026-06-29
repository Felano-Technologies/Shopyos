const express = require('express');
const router = express.Router();
const { getBuyerAnalytics } = require('../controllers/buyerAnalyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/analytics', protect, getBuyerAnalytics);

module.exports = router;
