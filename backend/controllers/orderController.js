// controllers/orderController.js
// Order management controller

const repositories = require('../db/repositories');
const crypto = require('crypto');
const { logger } = require('../config/logger');

/**
 * Generate unique order number
 * @returns {string}
 */
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

/**
 * @route   POST /api/orders/create
 * @desc    Create order from cart
 * @access  Private
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      deliveryAddress,
      deliveryCity,
      deliveryCountry,
      deliveryPhone,
      deliveryNotes,
      paymentMethod = 'paystack'
    } = req.body;

    // Validate delivery info
    if (!deliveryAddress || !deliveryCity || !deliveryPhone) {
      return res.status(400).json({
        success: false,
        error: 'Delivery address, city, and phone are required'
      });
    }

    // Get cart with items
    const cart = await repositories.carts.getCartWithItems(userId);

    if (!cart || !cart.cart_items || cart.cart_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty'
      });
    }

    // Group items by store
    const itemsByStore = {};
    for (const item of cart.cart_items) {
      const storeId = item.products.store_id;
      if (!itemsByStore[storeId]) {
        itemsByStore[storeId] = [];
      }
      itemsByStore[storeId].push(item);
    }

    // Create separate order for each store
    const createdOrders = [];

    for (const [storeId, items] of Object.entries(itemsByStore)) {
      // Calculate order total (following frontend logic)
      let subtotal = 0;
      const orderItems = items.map(item => {
        const price = item.products.price;
        const itemSubtotal = price * item.quantity;
        subtotal += itemSubtotal;

        return {
          product_id: item.product_id,
          product_title: item.products.title,
          quantity: item.quantity,
          price: price,
          subtotal: itemSubtotal
        };
      });

      const nhilAmount = subtotal * 0.025;
      const getFundAmount = subtotal * 0.025;
      const vatAmount = subtotal * 0.15;
      const serviceCharge = 5.00;

      const tax = nhilAmount + getFundAmount + vatAmount + serviceCharge;
      const deliveryFee = 15.00;
      const totalAmount = subtotal + tax + deliveryFee;

      // Create order
      const orderData = {
        order_number: generateOrderNumber(),
        buyer_id: userId,
        store_id: storeId,
        status: 'pending',
        subtotal: subtotal,
        tax: tax,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        delivery_address_line1: deliveryAddress,
        delivery_city: deliveryCity,
        delivery_country: deliveryCountry || 'Ghana',
        delivery_phone: deliveryPhone,
        delivery_notes: deliveryNotes || null
      };

      // Map payment method to DB enum
      let dbPaymentMethod = 'card';
      if (paymentMethod === 'momo') dbPaymentMethod = 'mobile_money';
      else if (paymentMethod === 'cod') dbPaymentMethod = 'bank_transfer'; // Placeholder for COD until enum is updated

      const order = await repositories.orders.createOrderWithItems(orderData, orderItems, dbPaymentMethod);

      // Notify customer about order confirmation
      await repositories.notifications.create({
        user_id: userId,
        type: 'order_placed',
        title: 'Order Placed Successfully',
        message: `Your order #${order.order_number} has been placed successfully. Total: ₵${totalAmount.toFixed(2)}`,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          totalAmount: totalAmount
        }
      });

      // Notify seller about new order
      const store = await repositories.stores.findById(storeId);
      if (store && store.owner_id) {
        await repositories.notifications.create({
          user_id: store.owner_id,
          type: 'new_order',
          title: 'New Order Received',
          message: `You have a new order #${order.order_number} worth ₵${totalAmount.toFixed(2)}`,
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            storeId: storeId,
            totalAmount: totalAmount,
            itemCount: orderItems.length
          }
        });
      }

      createdOrders.push({
        ...order,
        payment
      });
    }

    // Clear cart after successful order creation
    await repositories.carts.clearCart(userId);

    res.status(201).json({
      success: true,
      message: 'Order(s) created successfully',
      orders: createdOrders,
      count: createdOrders.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/orders/my-orders
 * @desc    Get user's orders (buyer perspective)
 * @access  Private
 */
const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const { data: orders, count: totalCount } = await repositories.orders.getBuyerOrders(userId, {
      status,
      limit: limitNum,
      offset: offsetNum
    });

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/orders/store/:storeId
 * @desc    Get store orders (seller perspective)
 * @access  Private (Seller/Admin)
 */
const getStoreOrders = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    // Verify store ownership
    const store = await repositories.stores.findById(storeId);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    if (store.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view these orders'
      });
    }

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    const { data: orders, count: totalCount } = await repositories.orders.getStoreOrders(storeId, {
      status,
      limit: limitNum,
      offset: offsetNum
    });

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        totalItems: totalCount,
        totalPages: totalPages,
        currentPage: currentPage,
        itemsPerPage: limitNum,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/orders/:orderId
 * @desc    Get order details
 * @access  Private
 */
const getOrderDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await repositories.orders.getOrderDetails(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify access (buyer, seller, or admin)
    const store = await repositories.stores.findById(order.store_id);
    const isBuyer = order.buyer_id === userId;
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this order'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/orders/:orderId/status
 * @desc    Update order status
 * @access  Private (Seller/Admin)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = [
      'pending', 'paid', 'confirmed',
      'ready_for_pickup', 'in_transit', 'delivered',
      'completed', 'cancelled', 'refunded'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses
      });
    }

    // Get order
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify authorization (store owner or admin)
    const store = await repositories.stores.findById(order.store_id);
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this order'
      });
    }

    // Update status
    const updatedOrder = await repositories.orders.updateStatus(orderId, status);

    // Notify customer about status changes
    const statusMessages = {
      'confirmed': {
        title: 'Order Confirmed',
        message: `Your order #${order.order_number} has been confirmed by the seller and is being prepared.`
      },
      'preparing': {
        title: 'Order Being Prepared',
        message: `Your order #${order.order_number} is now being prepared.`
      },
      'ready_for_pickup': {
        title: 'Order Ready for Pickup',
        message: `Your order #${order.order_number} is ready! A driver will pick it up soon.`
      },
      'cancelled': {
        title: 'Order Cancelled',
        message: `Your order #${order.order_number} has been cancelled. You will be refunded shortly.`
      },
      'completed': {
        title: 'Order Completed',
        message: `Your order #${order.order_number} is complete. Thank you for shopping with us!`
      }
    };

    if (statusMessages[status]) {
      await repositories.notifications.create({
        user_id: order.buyer_id,
        type: `order_${status}`,
        title: statusMessages[status].title,
        message: statusMessages[status].message,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          status: status
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated',
      order: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/orders/:orderId/cancel
 * @desc    Cancel order
 * @access  Private
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Get order
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify authorization
    const store = await repositories.stores.findById(order.store_id);
    const isSeller = store && store.owner_id === userId;
    const isBuyer = order.buyer_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'paid', 'confirmed'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Order cannot be cancelled in ${order.status} status`
      });
    }

    // Cancel order
    const cancelledOrder = await repositories.orders.cancelOrder(
      orderId,
      reason || 'Cancelled by buyer'
    );

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order: cancelledOrder
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/orders/:orderId/by-number/:orderNumber
 * @desc    Get order by order number
 * @access  Private
 */
const getOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user.id;

    const order = await repositories.orders.findByOrderNumber(orderNumber);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify access
    const store = await repositories.stores.findById(order.store_id);
    const isBuyer = order.buyer_id === userId;
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this order'
      });
    }

    // Get full details
    const orderDetails = await repositories.orders.getOrderDetails(order.id);

    res.status(200).json({
      success: true,
      order: orderDetails
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/orders/:orderId/verify-payment
 * @desc    Simulate and verify payment (DEVELOPMENT ONLY — use Paystack webhooks in production)
 * @access  Private
 */
const verifyPayment = async (req, res, next) => {
  // ── Guard: this endpoint is dev-only ──
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      error: 'This endpoint is not available in production. Use the Paystack payment flow instead.'
    });
  }

  try {
    const { orderId } = req.params;
    const { status = 'success', paymentId = 'SIM-' + Date.now() } = req.body;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.buyer_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    if (status !== 'success') {
      return res.status(400).json({ success: false, error: 'Payment failed simulation' });
    }

    // Update payment record in DB
    const { error: pError } = await repositories.orders.db
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        provider_transaction_id: paymentId
      })
      .eq('order_id', orderId);

    if (pError) throw pError;

    // Update order status to 'paid' (Matches order_status enum)
    const updatedOrder = await repositories.orders.updateStatus(orderId, 'paid');

    // Notify user
    await repositories.notifications.create({
      user_id: userId,
      type: 'payment_success',
      title: 'Payment Confirmed',
      message: `Payment for order #${order.order_number} has been confirmed. The store will start preparing it soon.`,
      data: { orderId: order.id, orderNumber: order.order_number }
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getStoreOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  getOrderByNumber,
  verifyPayment
};
