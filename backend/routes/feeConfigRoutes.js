// routes/feeConfigRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getPublicFeeConfigs } = require('../controllers/feeConfigController');

// @route   GET /api/v1/fee-config/public
// @desc    Get public fee configurations (delivery caps, bargaining constraints, etc.)
// @access  Private (Registered buyers/sellers)
router.get('/public', protect, getPublicFeeConfigs);

module.exports = router;
