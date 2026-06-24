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
  verifyPayment,
  confirmDelivery
} = require('../controllers/orderController');
const { protect, hasAnyRole } = require('../middleware/authMiddleware');
const { validateCreateOrder } = require('../middleware/validators');
const { auditLog } = require('../middleware/auditMiddleware');

// All order routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/orders/create:
 *   post:
 *     summary: Create a new order
 *     description: Creates an order from the buyer's cart items. Requires authentication.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - deliveryAddress
 *               - paymentMethod
 *             properties:
 *               items:
 *                 type: array
 *                 description: List of products and quantities to order
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       description: ID of the product
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       description: Number of units to order
 *               deliveryAddress:
 *                 type: string
 *                 description: Full delivery address for the order
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method (e.g. card, mobile_money, cash_on_delivery)
 *               promoCode:
 *                 type: string
 *                 description: Optional promotional code for a discount
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       400:
 *         description: Validation error or invalid request body
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// @route   POST /api/orders/create
// @desc    Create order from cart
// @access  Private
const requireDisclaimer = require('../middleware/requireDisclaimer');

router.post('/create', requireDisclaimer('refund_policy'), validateCreateOrder, auditLog('place_order', 'order'), createOrder);

/**
 * @swagger
 * /api/v1/orders/my-orders:
 *   get:
 *     summary: Get the authenticated user's orders
 *     description: Returns a paginated list of orders belonging to the currently authenticated buyer.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of orders per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled]
 *         description: Filter orders by status
 *     responses:
 *       200:
 *         description: List of orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 */
// @route   GET /api/orders/my-orders
// @desc    Get user's orders
// @access  Private
router.get('/my-orders', getMyOrders);

/**
 * @swagger
 * /api/v1/orders/number/{orderNumber}:
 *   get:
 *     summary: Get an order by its order number
 *     description: Retrieves the details of a specific order using the human-readable order number.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique order number (e.g. ORD-20240101-XXXX)
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Order not found
 */
// @route   GET /api/orders/number/:orderNumber
// @desc    Get order by order number
// @access  Private
router.get('/number/:orderNumber', getOrderByNumber);

/**
 * @swagger
 * /api/v1/orders/store/{storeId}:
 *   get:
 *     summary: Get all orders for a specific store
 *     description: Returns a paginated list of orders placed at a given store. Restricted to sellers and admins.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the store whose orders are being retrieved
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of orders per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled]
 *         description: Filter orders by status
 *     responses:
 *       200:
 *         description: Store orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller or admin role required
 *       404:
 *         description: Store not found
 */
// @route   GET /api/orders/store/:storeId
// @desc    Get store orders
// @access  Private (Seller/Admin)
router.get('/store/:storeId', hasAnyRole('seller', 'admin'), getStoreOrders);

/**
 * @swagger
 * /api/v1/orders/{orderId}:
 *   get:
 *     summary: Get order details by ID
 *     description: Retrieves full details for a specific order by its database ID.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the order
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Order not found
 */
// @route   GET /api/orders/:orderId
// @desc    Get order details
// @access  Private
router.get('/:orderId', getOrderDetails);

/**
 * @swagger
 * /api/v1/orders/{orderId}/status:
 *   put:
 *     summary: Update the status of an order
 *     description: Allows a seller or admin to update the fulfillment status of an order.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the order to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, processing, shipped, delivered, cancelled]
 *                 description: The new status for the order
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       400:
 *         description: Invalid status value
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — seller or admin role required
 *       404:
 *         description: Order not found
 */
// @route   PUT /api/orders/:orderId/status
// @desc    Update order status
// @access  Private (Seller/Admin)
router.put('/:orderId/status', hasAnyRole('seller', 'admin'), auditLog('update_order_status', 'order'), updateOrderStatus);

/**
 * @swagger
 * /api/v1/orders/{orderId}/cancel:
 *   put:
 *     summary: Cancel an order
 *     description: Cancels an order that is still in a cancellable state (e.g. pending). Accessible by the buyer, seller, or admin.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the order to cancel
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Optional reason for cancellation
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       400:
 *         description: Order cannot be cancelled in its current state
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Order not found
 */
// @route   PUT /api/orders/:orderId/cancel
// @desc    Cancel order (buyer/seller/admin, only when status is pending)
// @access  Private
router.put('/:orderId/cancel', auditLog('cancel_order', 'order'), cancelOrder);

/**
 * @swagger
 * /api/v1/orders/{orderId}/confirm-delivery:
 *   put:
 *     summary: Confirm delivery of an order
 *     description: Allows the buyer to confirm that they have received their order, marking it as delivered.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the order to confirm delivery for
 *     responses:
 *       200:
 *         description: Delivery confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *       400:
 *         description: Order is not in a shipped state or already confirmed
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Order not found
 */
// @route   PUT /api/orders/:orderId/confirm-delivery
// @desc    Buyer confirms receipt of order
// @access  Private
router.put('/:orderId/confirm-delivery', confirmDelivery);

/**
 * @swagger
 * /api/v1/orders/{orderId}/verify-payment:
 *   post:
 *     summary: Verify payment for an order
 *     description: Triggers payment verification for a specific order, typically after a payment gateway callback.
 *     tags: [Orders]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the order whose payment is being verified
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 order:
 *                   type: object
 *       400:
 *         description: Payment verification failed
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       404:
 *         description: Order not found
 */
// @route   POST /api/orders/:orderId/verify-payment
// @desc    Verify payment
// @access  Private
router.post('/:orderId/verify-payment', verifyPayment);

module.exports = router;
