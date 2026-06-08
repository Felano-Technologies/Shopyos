const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getBalance, getLoyaltyTransactions } = require('../controllers/loyaltyController');

router.get('/balance', protect, getBalance);
router.get('/transactions', protect, getLoyaltyTransactions);

module.exports = router;
