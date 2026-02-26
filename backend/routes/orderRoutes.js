// routes/orderRoutes.js
// Order management routes

const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  getOrderByNumber,
  verifyPayment
} = require('../controllers/orderController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const { validateCreateOrder } = require('../middleware/validators');

// All order routes require authentication
router.use(protect);

// @route   POST /api/orders/create
// @desc    Create order from cart
// @access  Private
router.post('/create', validateCreateOrder, createOrder);

// @route   GET /api/orders/my-orders
// @desc    Get user's orders
// @access  Private
router.get('/my-orders', getMyOrders);

// @route   GET /api/orders/number/:orderNumber
// @desc    Get order by order number
// @access  Private
router.get('/number/:orderNumber', getOrderByNumber);

// @route   GET /api/orders/store/:storeId
// @desc    Get store orders
// @access  Private (Seller/Admin)
router.get('/store/:storeId', hasAnyRole('seller', 'admin'), getStoreOrders);

// @route   GET /api/orders/:orderId
// @desc    Get order details
// @access  Private
router.get('/:orderId', getOrderDetails);

// @route   PUT /api/orders/:orderId/status
// @desc    Update order status
// @access  Private (Seller/Admin)
router.put('/:orderId/status', hasAnyRole('seller', 'admin'), updateOrderStatus);

// @route   PUT /api/orders/:orderId/cancel
// @desc    Cancel order
// @access  Private
// @route   POST /api/orders/:orderId/verify-payment
// @desc    Verify payment
// @access  Private
router.post('/:orderId/verify-payment', verifyPayment);

module.exports = router;
