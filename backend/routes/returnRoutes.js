const express = require('express');
const router = express.Router();
const { protect, seller: isSeller, admin: isAdmin } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');
const {
  createReturnRequest,
  getBuyerReturns,
  getSellerReturns,
  sellerRespondToReturn,
  getAdminReturns,
  adminActOnReturn
} = require('../controllers/returnController');

// Buyer
router.post('/', protect, auditLog('request_return', 'order'), createReturnRequest);
router.get('/my', protect, getBuyerReturns);

// Seller
router.get('/seller', protect, isSeller, getSellerReturns);
router.patch('/:returnId/respond', protect, isSeller, sellerRespondToReturn);

// Admin
router.get('/admin', protect, isAdmin, getAdminReturns);
router.patch('/:returnId/admin', protect, isAdmin, adminActOnReturn);

module.exports = router;
