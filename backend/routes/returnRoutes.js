const express = require('express');
const router = express.Router();
const { protect, isSeller, isAdmin } = require('../middleware/authMiddleware');
const {
  createReturnRequest,
  getBuyerReturns,
  getSellerReturns,
  sellerRespondToReturn,
  getAdminReturns,
  adminActOnReturn
} = require('../controllers/returnController');

// Buyer
router.post('/', protect, createReturnRequest);
router.get('/my', protect, getBuyerReturns);

// Seller
router.get('/seller', protect, isSeller, getSellerReturns);
router.patch('/:returnId/respond', protect, isSeller, sellerRespondToReturn);

// Admin
router.get('/admin', protect, isAdmin, getAdminReturns);
router.patch('/:returnId/admin', protect, isAdmin, adminActOnReturn);

module.exports = router;
