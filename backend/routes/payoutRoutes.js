// routes/payoutRoutes.js
const express = require('express');
const router = express.Router();
const { requestPayout, getPayoutHistory, processPayout } = require('../controllers/payoutController');
const { protect, seller, admin } = require('../middleware/authMiddleware');
const { validateRequestPayout } = require('../middleware/validators');

router.use(protect);

// @route   POST /api/payouts/request
// @access  Seller
router.post('/request', seller, validateRequestPayout, requestPayout);

// @route   GET /api/payouts/history/:storeId
// @access  Seller
router.get('/history/:storeId', seller, getPayoutHistory);

// @route   PUT /api/payouts/:payoutId/process
// @access  Admin
router.put('/:payoutId/process', admin, processPayout);

module.exports = router;
