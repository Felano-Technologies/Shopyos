// routes/cartRoutes.js
// Cart management routes

const express = require('express');
const router = express.Router();
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartItemCount
} = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

// All cart routes require authentication
router.use(protect);

// @route   POST /api/cart/add
// @desc    Add item to cart
// @access  Private
router.post('/add', addToCart);

// @route   GET /api/cart
// @desc    Get user's cart
// @access  Private
router.get('/', getCart);

// @route   GET /api/cart/count
// @desc    Get cart item count
// @access  Private
router.get('/count', getCartItemCount);

// @route   PUT /api/cart/item/:itemId
// @desc    Update cart item quantity
// @access  Private
router.put('/item/:itemId', updateCartItem);

// @route   DELETE /api/cart/item/:itemId
// @desc    Remove item from cart
// @access  Private
router.delete('/item/:itemId', removeFromCart);

// @route   DELETE /api/cart/clear
// @desc    Clear cart
// @access  Private
router.delete('/clear', clearCart);

module.exports = router;
