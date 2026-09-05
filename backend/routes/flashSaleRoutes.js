const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const requireDisclaimer = require('../middleware/requireDisclaimer');
const {
  getActiveSale,
  getSlotsList,
  submitFlashSale,
  getSellerSales,
  cancelFlashSale,
  createSlot,
  updateSlot,
  deleteSlot,
  getAdminSales,
  reviewFlashSale
} = require('../controllers/flashSaleController');

// --- Public Endpoints ---
router.get('/active', getActiveSale);
router.get('/slots', getSlotsList);

// --- Seller Endpoints ---
// Seller submission requires flash sale terms disclaimer acknowledgement
router.post('/submit', protect, requireDisclaimer('flash_sale_terms'), submitFlashSale);
router.get('/my-sales', protect, getSellerSales);
router.delete('/:id/cancel', protect, cancelFlashSale);

// --- Admin Endpoints ---
router.post('/slots', protect, admin, createSlot);
router.patch('/slots/:id', protect, admin, updateSlot);
router.delete('/slots/:id', protect, admin, deleteSlot);
router.get('/admin/sales', protect, admin, getAdminSales);
router.patch('/:id/review', protect, admin, reviewFlashSale);

module.exports = router;
