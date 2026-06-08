const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getActiveSale, createSale, endSale } = require('../controllers/flashSaleController');

// Public — any buyer can fetch the current flash sale for the home screen
router.get('/active', getActiveSale);

// Admin-only — only platform admins can create or end flash sales
router.post('/', protect, admin, createSale);
router.patch('/:id/end', protect, admin, endSale);

module.exports = router;
