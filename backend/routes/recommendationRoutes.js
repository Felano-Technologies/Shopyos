const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPersonalized, getTrending } = require('../controllers/recommendationController');

// GET /api/v1/recommendations/trending?category=Electronics&limit=10
router.get('/trending', getTrending);

// GET /api/v1/recommendations/personalized?limit=10
router.get('/personalized', protect, getPersonalized);

module.exports = router;
