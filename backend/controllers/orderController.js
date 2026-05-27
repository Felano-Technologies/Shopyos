// controllers/orderController.js
// Order management controller

const repositories = require('../db/repositories');
const crypto = require('crypto');
const { logger } = require('../config/logger');
const rabbitMQService = require('../services/rabbitmq');
const notificationService = require('../services/notificationService');
const { haversineKm, calculateDeliveryFee } = require('../utils/distance');

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
      paymentMethod = 'paystack',
      buyerLat,    // optional — used to calculate distance-based delivery fee
      buyerLng
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

    // ── Validation Pass ──────────────────────────────────────────────────────────
    // Ensure ALL stores are within range before creating ANY orders to avoid partial checkout success.
    for (const [storeId] of Object.entries(itemsByStore)) {
      const store = await repositories.stores.findById(storeId);
      if (store && buyerLat !== undefined && buyerLng !== undefined && store.latitude !== null && store.longitude !== null) {
        const distanceKm = haversineKm(
          parseFloat(store.latitude), parseFloat(store.longitude),
          parseFloat(buyerLat), parseFloat(buyerLng)
        );
        const { withinRange } = calculateDeliveryFee(store, distanceKm);
        if (!withinRange) {
          return res.status(400).json({
            success: false,
            error: `Delivery address is outside the delivery radius for ${store.store_name || 'one of the stores'}`
          });
        }
      }
    }

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

      const tax = 1.00; // Flat Buyer Protection Fee

      // Dynamic delivery fee based on store settings + buyer location
      const deliveryState = req.body.deliveryState || 'Greater Accra';
      let deliveryFee = 5; // Default minimum delivery fee
      const store = await repositories.stores.findById(storeId);
      if (store) {
        if (
          buyerLat !== undefined && buyerLng !== undefined &&
          store.latitude !== null && store.longitude !== null
        ) {
          const distanceKm = haversineKm(
            parseFloat(store.latitude), parseFloat(store.longitude),
            parseFloat(buyerLat), parseFloat(buyerLng)
          );
          const { fee, withinRange } = calculateDeliveryFee(store, distanceKm);
          
          if (!withinRange) {
            return res.status(400).json({
              success: false,
              error: `Delivery address is outside the delivery radius for ${store.store_name || 'one of the stores'}`
            });
          }
          
          deliveryFee = fee !== null ? fee : (parseFloat(store.delivery_base_fee) || 5);
        } else {
          deliveryFee = parseFloat(store.delivery_base_fee) || 5;
        }

        // --- Regional Pricing Logic ---
        const storeRegion = (store.state_province || 'Greater Accra').trim().toLowerCase();
        const targetRegion = (deliveryState || 'Greater Accra').trim().toLowerCase();

        if (storeRegion === targetRegion) {
          // Same Region: min 15, max 30
          deliveryFee = Math.max(15, Math.min(deliveryFee, 30));
        } else {
          // Cross Region: min 40
          deliveryFee = Math.max(deliveryFee, 40);
        }
      }

      const totalAmount = subtotal + tax + deliveryFee;

      // Update order creation data to include delivery_state_province
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
        delivery_city: req.body.deliveryCity || 'Accra',
        delivery_state_province: deliveryState,
        delivery_country: deliveryCountry || 'Ghana',
        delivery_phone: deliveryPhone,
        delivery_notes: deliveryNotes || null
      };

      // Map payment method to DB enum
      let dbPaymentMethod = 'card';
      if (paymentMethod === 'momo') dbPaymentMethod = 'mobile_money';

      const order = await repositories.orders.createOrderWithItems(orderData, orderItems, dbPaymentMethod);

      // Notify customer about order confirmation
      await notificationService.sendNotification({
        userId: userId,
        type: 'order_placed',
        title: 'Order Placed Successfully',
        message: `Your order #${order.order_number} has been placed successfully. Total: ₵${totalAmount.toFixed(2)}`,
        relatedId: order.id,
        relatedType: 'order',
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          totalAmount: totalAmount
        },
        push: { data: { screen: 'order', orderId: order.id } }
      });

      // Notify seller about new order via in-app
      if (store && store.owner_id) {
        await notificationService.sendNotification({
          userId: store.owner_id,
          type: 'new_order',
          title: 'New Order Received',
          message: `You have a new order #${order.order_number} worth ₵${totalAmount.toFixed(2)}`,
          relatedId: order.id,
          relatedType: 'order',
          data: {
            orderId: order.id,
            orderNumber: order.order_number,
            storeId: storeId,
            totalAmount: totalAmount,
            itemCount: orderItems.length
          },
          push: { data: { screen: 'order', orderId: order.id } }
        });

        // Publish to RabbitMQ for seller email / sms
        const storeOwner = await repositories.users.findById(store.owner_id);
        const storeProfile = await repositories.userProfiles.findByUserId(store.owner_id);

        const sellerPayload = {
          eventType: 'ORDER_CREATED',
          userId: store.owner_id,
          role: 'seller',
          email: storeOwner?.email,
          phone: storeProfile?.phone,
          orderId: order.id,
          referenceId: order.id,
          templateData: { orderId: order.order_number, amount: totalAmount.toFixed(2), itemsCount: orderItems.length }
        };
        if (storeOwner?.email) rabbitMQService.publishMessage('email', sellerPayload);
        if (storeProfile?.phone) rabbitMQService.publishMessage('sms', sellerPayload);
      }

      // Publish to RabbitMQ for buyer email / sms
      const buyerInfo = await repositories.users.findById(userId);
      const buyerProfile = await repositories.userProfiles.findByUserId(userId);

      const buyerPayload = {
        eventType: 'ORDER_CREATED',
        userId: userId,
        role: 'buyer',
        email: buyerInfo?.email,
        phone: deliveryPhone || buyerProfile?.phone,
        orderId: order.id,
        referenceId: order.id,
        templateData: {
          orderId: order.order_number,
          amount: totalAmount.toFixed(2),
          customerName: buyerProfile?.full_name || 'Customer',
          itemsCount: orderItems.length
        }
      };

      if (buyerInfo?.email) rabbitMQService.publishMessage('email', buyerPayload);
      if (buyerPayload.phone) rabbitMQService.publishMessage('sms', buyerPayload);

      createdOrders.push({
        ...order
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
      // Allow admins to view any store's orders
      const isAdmin = req.user.roles?.includes('admin');
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view these orders'
        });
      }
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

    // Fast checks first — use the store data already embedded in the join result
    // to avoid an extra DB round-trip for every order fetch.
    const isBuyer = order.buyer_id === userId;
    const isSeller = order.store?.owner_id === userId;   // store is already joined

    // Only hit the DB for the admin role check when the cheap checks fail
    const isAdmin = (!isBuyer && !isSeller)
      ? await repositories.users.hasRole(userId, 'admin')
      : false;

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

    // Enforce role boundary: sellers cannot set orders to in_transit, delivered, or completed
    if (isSeller && !isAdmin) {
      const forbiddenStatusesForSeller = ['in_transit', 'delivered', 'completed'];
      if (forbiddenStatusesForSeller.includes(status)) {
        return res.status(403).json({
          success: false,
          error: `Sellers are not authorized to update order status to ${status}. This is managed by the delivery flow.`
        });
      }
    }

    // Update status
    const updatedOrder = await repositories.orders.updateStatus(orderId, status);

    // Automatically create a delivery record if status is ready_for_pickup
    if (status === 'ready_for_pickup') {
      try {
        const existingDelivery = await repositories.deliveries.findByOrderId(orderId);
        if (!existingDelivery) {
          const deliveryFeeVal = parseFloat(order.delivery_fee || 0);
          const newDelivery = await repositories.deliveries.createDelivery({
            orderId,
            pickupAddress: store.address_line1 || 'Store Address',
            deliveryAddress: order.delivery_address_line1 || order.delivery_address || 'Customer Address',
            pickupLatitude: store.latitude || 0,
            pickupLongitude: store.longitude || 0,
            deliveryLatitude: order.delivery_latitude || 0,
            deliveryLongitude: order.delivery_longitude || 0,
            deliveryFee: deliveryFeeVal,
            driverEarnings: deliveryFeeVal * 0.85
          });
          logger.info(`Automatically created delivery for order ${order.order_number}`);

          // --- Notify Online Drivers in Range (10 km) ---
          try {
            const onlineDrivers = await repositories.drivers.getOnlineDrivers();
            const driversInRange = onlineDrivers.filter(drv => {
              if (!store.latitude || !store.longitude || !drv.latitude || !drv.longitude) return false;
              const dist = haversineKm(
                parseFloat(store.latitude), parseFloat(store.longitude),
                parseFloat(drv.latitude), parseFloat(drv.longitude)
              );
              return dist <= 10.0; // 10 km radius
            });

            logger.info(`Found ${driversInRange.length} online drivers within 10 km of ${store.store_name}`);

            for (const drv of driversInRange) {
              try {
                // 1. Push notification
                await notificationService.sendPushNotification({
                  userId: drv.user_id,
                  title: 'New Delivery Request Available! 🚚',
                  body: `New delivery request from ${store.store_name} in ${store.city} is available near you!`,
                  data: {
                    screen: 'driver_dashboard',
                    deliveryId: newDelivery.id
                  }
                });

                // 2. Email notification
                if (drv.email) {
                  await notificationService.sendEmail({
                    to: drv.email,
                    subject: 'New Delivery Request Available! 🚚',
                    html: `
                      <div style="font-family: sans-serif; padding: 20px; color: #0F172A; max-width: 600px; margin: auto; border: 1px solid #E2E8F0; border-radius: 12px;">
                        <h2 style="color: #0C1559; border-bottom: 2px solid #F1F5F9; padding-bottom: 10px;">New Delivery Request</h2>
                        <p style="font-size: 16px; line-height: 24px;">Hello <strong>${drv.full_name}</strong>,</p>
                        <p style="font-size: 15px; line-height: 24px;">A new delivery request is available near you at <strong>${store.store_name}</strong> in ${store.city}!</p>
                        <p style="font-size: 15px; margin: 20px 0;"><strong>Delivery Fee:</strong> ₵${deliveryFeeVal.toFixed(2)}</p>
                        <p style="margin-top: 30px; text-align: center;">
                          <a href="${process.env.FRONTEND_URL || 'https://shopyos.com'}/driver/dashboard" 
                             style="background: #84cc16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                             Open Dashboard
                          </a>
                        </p>
                      </div>
                    `,
                    text: `Hello ${drv.full_name}, a new delivery request is available near you at ${store.store_name}. Open the Shopyos Driver app to accept!`
                  });
                }

                // 3. SMS notification
                if (drv.phone) {
                  await notificationService.sendSMS({
                    to: drv.phone,
                    message: `Shopyos: New delivery request from ${store.store_name} is available near you. Open the Driver app to accept!`
                  });
                }
              } catch (notifErr) {
                logger.error(`Failed to send available request notification to driver ${drv.user_id}:`, notifErr.message);
              }
            }
          } catch (listErr) {
            logger.error(`Failed to fetch online drivers or dispatch notifications:`, listErr.message);
          }
        }
      } catch (deliveryErr) {
        logger.error(`Failed to automatically create delivery for order ${order.order_number}:`, deliveryErr.message);
      }
    }

    // Notify customer about status changes
    await notificationService.sendOrderNotification(order.buyer_id, order, status);

    if (status === 'delivered' || status === 'completed') {
      const buyer = await repositories.users.findById(order.buyer_id);
      if (buyer?.email) {
        rabbitMQService.publishMessage('email', {
          eventType: 'ORDER_DELIVERED',
          userId: order.buyer_id,
          role: 'buyer',
          email: buyer.email,
          referenceId: order.id,
          templateData: {
            orderId: order.order_number,
            amount: order.total_amount
          }
        });
      }
    }

    const { cacheDelPattern } = require('../config/redis');
    if (cacheDelPattern) {
      await cacheDelPattern(`shopyos:stores:dashboard:${order.store_id}*`);
      await cacheDelPattern(`shopyos:stores:analytics:${order.store_id}*`);
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
    const isAdmin = (!isBuyer && !isSeller)
      ? await repositories.users.hasRole(userId, 'admin')
      : false;

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to cancel this order'
      });
    }

    // Buyers can only cancel while the order is still 'pending'.
    // Sellers and admins retain a broader window (pending → confirmed).
    const cancellableStatuses = (isBuyer && !isAdmin)
      ? ['pending']
      : ['pending', 'paid', 'confirmed'];

    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: isBuyer
          ? 'Orders can only be cancelled while they are pending'
          : `Order cannot be cancelled in '${order.status}' status`
      });
    }

    // Cancel order
    const cancelledOrder = await repositories.orders.cancelOrder(
      orderId,
      reason || 'Cancelled by user'
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
    await notificationService.sendNotification({
      userId: userId,
      type: 'payment_success',
      title: 'Payment Confirmed',
      message: `Payment for order #${order.order_number} has been confirmed. The store will start preparing it soon.`,
      relatedId: order.id,
      relatedType: 'order',
      data: { orderId: order.id, orderNumber: order.order_number },
      push: { data: { screen: 'order', orderId: order.id } }
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

/**
 * @route   PUT /api/orders/:orderId/confirm-delivery
 * @desc    Buyer confirms receipt of order. Releases funds from escrow to seller.
 * @access  Private
 */
const confirmDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Get order
    const order = await repositories.orders.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    
    if (order.buyer_id !== userId) return res.status(403).json({ success: false, error: 'Not authorized' });
    
    if (order.escrow_status !== 'HELD') {
       return res.status(400).json({ success: false, error: 'Funds are not currently held in escrow for this order' });
    }

    // Atomic delivery confirmation via RPC
    const { data: rpcResult, error: rpcError } = await repositories.orders.db.rpc('confirm_delivery_atomic', {
      p_order_id: orderId,
      p_user_id: userId,
      p_is_admin: req.user.roles?.includes('admin') || false
    });

    if (rpcError) throw rpcError;
    if (!rpcResult.success) {
      return res.status(400).json(rpcResult);
    }

    // Fetch updated order for response and notifications
    const updatedOrder = await repositories.orders.getOrderDetails(orderId);
    
    // Notify seller
    if (updatedOrder && updatedOrder.store?.owner_id) {
        const sellerPayout = rpcResult.seller_payout;
        await notificationService.sendNotification({
            userId: updatedOrder.store.owner_id,
            type: 'payout_released',
            title: 'Order Completed & Payout Released',
            message: `Buyer confirmed delivery for order #${updatedOrder.order_number}. ₵${sellerPayout.toFixed(2)} has been added to your balance.`,
            relatedId: updatedOrder.id,
            relatedType: 'order',
            data: { orderId: updatedOrder.id, orderNumber: updatedOrder.order_number, amount: sellerPayout }
        }).catch(e => logger.error('Seller payout notification failed', e));
    }

    res.status(200).json({
        success: true,
        message: 'Delivery confirmed. Funds released to seller and driver.',
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
  verifyPayment,
  confirmDelivery
};
