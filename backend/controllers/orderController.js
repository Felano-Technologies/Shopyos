// controllers/orderController.js
// Order management controller

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const crypto = require('node:crypto');
const { logger } = require('../config/logger');
const rabbitMQService = require('../services/rabbitmq');
const notificationService = require('../services/notificationService');
const { haversineKm, calculateDeliveryFee } = require('../utils/distance');
const { creditPoints, deductPoints, calcPointsDiscount } = require('./loyaltyController');
const { getPool } = require('../config/postgres');
const feeConfigService = require('../services/feeConfigService');

/**
 * Generate unique order number
 * @returns {string}
 */
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

async function validatePromoCode(pool, promoCode, userId) {
  const { rows: promoRows } = await pool.query(
    `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) AND is_active = true`,
    [promoCode.trim()]
  );
  const promo = promoRows[0];
  if (!promo) return { error: 'Invalid or expired promo code' };
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { error: 'This promo code has expired' };
  }
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return { error: 'Promo code usage limit reached' };
  }
  const { rows: usedRows } = await pool.query(
    `SELECT id FROM promo_code_uses WHERE code_id = $1 AND user_id = $2`,
    [promo.id, userId]
  );
  if (usedRows.length > 0) return { error: 'You have already used this promo code' };
  return { promo };
}

async function validateStoreDeliveryRanges(itemsByStore, buyerLat, buyerLng) {
  if (buyerLat === undefined || buyerLng === undefined) return null;
  for (const [storeId] of Object.entries(itemsByStore)) {
    const store = await repositories.stores.findById(storeId);
    if (!store?.latitude || !store?.longitude) continue;
    const distanceKm = haversineKm(
      Number.parseFloat(store.latitude), Number.parseFloat(store.longitude),
      Number.parseFloat(buyerLat), Number.parseFloat(buyerLng)
    );
    const { withinRange } = calculateDeliveryFee(store, distanceKm);
    if (!withinRange) return store.store_name || 'one of the stores';
  }
  return null;
}

async function processStoreOrder({ storeId, items, cart, req, userId, validatedPromo, validatedLoyaltyPoints, pool }) {
  const deliveryState = req.body.deliveryState || 'Greater Accra';
  const { buyerLat, buyerLng, deliveryAddress, deliveryCountry, deliveryPhone, deliveryNotes, paymentMethod = 'paystack', requestLastMile = false, lastMileFee } = req.body;

  let subtotal = 0;
  const orderItems = items.map(item => {
    const price = item.products.price;
    const itemSubtotal = price * item.quantity;
    subtotal += itemSubtotal;
    return { product_id: item.product_id, product_title: item.products.title, quantity: item.quantity, price, subtotal: itemSubtotal };
  });

  const tax = Number(await feeConfigService.get('default_tax_amount', 1));
  const store = await repositories.stores.findById(storeId);
  const deliveryFee = await calcOrderDeliveryFee(store, buyerLat, buyerLng, deliveryState);

  const storeRegion = store?.state_province?.trim().toLowerCase() || null;
  const targetRegion = (deliveryState || '').trim().toLowerCase();

  let transitFee = 0;
  let isInterRegional = false;
  let originHub = null;
  let destHub = null;
  let estArrivalDate = null;

  if (storeRegion && targetRegion && storeRegion !== targetRegion) {
    isInterRegional = true;
    if (repositories.parcelPartner) {
      originHub = await repositories.parcelPartner.getHubByRegionName(store?.state_province || 'Greater Accra');
      destHub = await repositories.parcelPartner.getHubByRegionName(deliveryState || 'Greater Accra');

      const transitConfig = await repositories.parcelPartner.getTransitConfig(
        store?.state_province || 'Greater Accra',
        deliveryState || 'Greater Accra'
      );

      const feeConfigService = require('../services/feeConfigService');
      transitFee = Number(transitConfig?.route_fee ?? await feeConfigService.get('parcel_partner_base_fee'));
      const transitDaysMin = transitConfig ? transitConfig.transit_days_min : 2;

      estArrivalDate = new Date();
      estArrivalDate.setDate(estArrivalDate.getDate() + transitDaysMin);
    } else {
      const feeConfigService = require('../services/feeConfigService');
      transitFee = Number(await feeConfigService.get('parcel_partner_base_fee') || 25);
      estArrivalDate = new Date();
      estArrivalDate.setDate(estArrivalDate.getDate() + 2);
    }
  }

  const totalSubtotal = cart.cart_items.reduce((sum, i) => sum + i.products.price * i.quantity, 0);
  const storeShare = totalSubtotal > 0 ? subtotal / totalSubtotal : 1;

  let promoDiscount = 0;
  if (validatedPromo) {
    const rawPromoDiscount = validatedPromo.type === 'percentage'
      ? (totalSubtotal * Number.parseFloat(validatedPromo.value)) / 100
      : Number.parseFloat(validatedPromo.value);
    promoDiscount = Number.parseFloat((Math.min(rawPromoDiscount, totalSubtotal) * storeShare).toFixed(2));
  }

  const { validPoints, discountAmount: loyaltyDiscount } = await calcPointsDiscount(
    Math.round(validatedLoyaltyPoints * storeShare),
    Math.round(validatedLoyaltyPoints * storeShare),
    subtotal
  );
  const storePointsUsed = validPoints;
  let totalBargainDiscount = 0;
  for (const item of items) {
    if (item.bargain_offer_id) {
      totalBargainDiscount += (Number(item.bargain_discount) || 0) * item.quantity;
    }
  }

  const discountAmount = Number.parseFloat((promoDiscount + loyaltyDiscount).toFixed(2));
  const lastMileCharge = isInterRegional && requestLastMile
    ? Number.parseFloat(lastMileFee ?? await feeConfigService.get('last_mile_default_fee') ?? 15)
    : 0;
  const totalAmount = Number.parseFloat((subtotal + tax + deliveryFee + transitFee + lastMileCharge - discountAmount - totalBargainDiscount).toFixed(2));

  const orderData = {
    order_number: generateOrderNumber(),
    buyer_id: userId,
    store_id: storeId,
    status: 'pending',
    subtotal,
    tax,
    delivery_fee: deliveryFee,
    discount_amount: discountAmount,
    promo_code_id: validatedPromo?.id ?? null,
    loyalty_points_used: storePointsUsed,
    total_amount: totalAmount,
    delivery_address_line1: deliveryAddress,
    delivery_city: req.body.deliveryCity || 'Accra',
    delivery_state_province: deliveryState,
    delivery_country: deliveryCountry || 'Ghana',
    delivery_phone: deliveryPhone,
    delivery_notes: deliveryNotes || null
  };

  let dbPaymentMethod = 'card';
  if (paymentMethod === 'momo') dbPaymentMethod = 'mobile_money';

  const order = await repositories.orders.createOrderWithItems(orderData, orderItems, dbPaymentMethod);

  if (isInterRegional) {
    await pool.query(
      `UPDATE orders
       SET order_type = 'inter_regional',
           origin_region = $1,
           destination_region = $2,
           origin_hub_id = $3,
           destination_hub_id = $4,
           parcel_transit_fee = $5,
           estimated_hub_arrival = $6,
           last_mile_requested = $7,
           last_mile_fee = $8
       WHERE id = $9`,
      [
        store?.state_province || 'Greater Accra',
        deliveryState || 'Greater Accra',
        originHub?.id || null,
        destHub?.id || null,
        transitFee,
        estArrivalDate.toISOString().split('T')[0],
        requestLastMile ? true : false,
        lastMileCharge,
        order.id
      ]
    );
    order.order_type = 'inter_regional';
    order.origin_region = store?.state_province || 'Greater Accra';
    order.destination_region = deliveryState || 'Greater Accra';
    order.origin_hub_id = originHub?.id || null;
    order.destination_hub_id = destHub?.id || null;
    order.parcel_transit_fee = transitFee;
    order.estimated_hub_arrival = estArrivalDate.toISOString().split('T')[0];
    order.last_mile_requested = requestLastMile;
    order.last_mile_fee = lastMileCharge;
  }

  if (totalBargainDiscount > 0) {
    await pool.query('UPDATE orders SET bargain_discount = $1 WHERE id = $2', [totalBargainDiscount, order.id]);
    order.bargain_discount = totalBargainDiscount;
  }
  for (const item of items) {
    if (item.bargain_offer_id) {
      await pool.query(
        'UPDATE order_items SET bargain_offer_id = $1, bargain_discount = $2 WHERE order_id = $3 AND product_id = $4',
        [item.bargain_offer_id, item.bargain_discount, order.id, item.product_id]
      );
      await pool.query(
        "UPDATE bargain_offers SET status = 'checked_out', updated_at = NOW() WHERE id = $1",
        [item.bargain_offer_id]
      );
    }
  }

  await notificationService.sendNotification({
    userId, type: 'order_placed', title: 'Order Placed Successfully',
    message: `Your order #${order.order_number} has been placed successfully. Total: ₵${totalAmount.toFixed(2)}`,
    relatedId: order.id, relatedType: 'order',
    data: { orderId: order.id, orderNumber: order.order_number, totalAmount },
    push: { data: { screen: 'order', orderId: order.id } }
  });

  if (store?.owner_id) {
    await notificationService.sendNotification({
      userId: store.owner_id, type: 'new_order', title: 'New Order Received',
      message: `You have a new order #${order.order_number} worth ₵${totalAmount.toFixed(2)}`,
      relatedId: order.id, relatedType: 'order',
      data: { orderId: order.id, orderNumber: order.order_number, storeId, totalAmount, itemCount: orderItems.length },
      push: { data: { screen: 'order', orderId: order.id } }
    });
    const storeOwner = await repositories.users.findById(store.owner_id);
    const storeProfile = await repositories.userProfiles.findByUserId(store.owner_id);
    const sellerPayload = {
      eventType: 'ORDER_CREATED', userId: store.owner_id, role: 'seller',
      email: storeOwner?.email, phone: storeProfile?.phone,
      orderId: order.id, referenceId: order.id,
      templateData: { orderId: order.order_number, amount: totalAmount.toFixed(2), itemsCount: orderItems.length }
    };
    if (storeOwner?.email) rabbitMQService.publishMessage('email', sellerPayload);
    if (storeProfile?.phone) rabbitMQService.publishMessage('sms', sellerPayload);
  }

  const buyerInfo = await repositories.users.findById(userId);
  const buyerProfile = await repositories.userProfiles.findByUserId(userId);
  const buyerPayload = {
    eventType: 'ORDER_CREATED', userId, role: 'buyer',
    email: buyerInfo?.email, phone: deliveryPhone || buyerProfile?.phone,
    orderId: order.id, referenceId: order.id,
    templateData: { orderId: order.order_number, amount: totalAmount.toFixed(2), customerName: buyerProfile?.full_name || 'Customer', itemsCount: orderItems.length }
  };
  if (buyerInfo?.email) rabbitMQService.publishMessage('email', buyerPayload);
  if (buyerPayload.phone) rabbitMQService.publishMessage('sms', buyerPayload);

  await creditPoints(userId, order.id, subtotal, pool).catch(err => logger.warn('Failed to credit loyalty points:', err));
  if (storePointsUsed > 0) {
    await deductPoints(userId, order.id, storePointsUsed, pool).catch(err => logger.warn('Failed to deduct loyalty points:', err));
  }

  return order;
}

async function calcOrderDeliveryFee(store, buyerLat, buyerLng, deliveryState) {
  const defaultBaseFee = await feeConfigService.get('delivery_default_base_fee');
  const defaultPerKmFee = await feeConfigService.get('delivery_default_per_km_fee');
  const baseFee = Number.parseFloat(store?.delivery_base_fee) || defaultBaseFee;

  let fee = baseFee;
  if (store?.latitude && store?.longitude && buyerLat !== undefined && buyerLng !== undefined) {
    const distanceKm = haversineKm(
      Number.parseFloat(store.latitude), Number.parseFloat(store.longitude),
      Number.parseFloat(buyerLat), Number.parseFloat(buyerLng)
    );
    const calc = calculateDeliveryFee(store, distanceKm, defaultPerKmFee);
    fee = calc.fee ?? baseFee;
  }

  // Floor only — no ceiling (Bolt model: fee scales linearly with distance)
  const minIntra = await feeConfigService.get('delivery_intra_min_fee');
  return Math.max(minIntra, fee);
}

/**
 * @route   POST /api/orders/create
 * @desc    Create order from cart
 * @access  Private
 */
const createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deliveryAddress, deliveryCity, deliveryPhone, promoCode, loyaltyPointsToRedeem = 0 } = req.body;
    const { buyerLat, buyerLng } = req.body;

    if (!deliveryAddress || !deliveryCity || !deliveryPhone) {
      return ApiResponse.error(res, 'Delivery address, city, and phone are required', 400);
    }

    const cart = await repositories.carts.getCartWithItems(userId);
    if (!cart?.cart_items?.length) {
      return ApiResponse.error(res, 'Cart is empty', 400);
    }

    const pool = getPool();
    let validatedPromo = null;
    if (promoCode) {
      const result = await validatePromoCode(pool, promoCode, userId);
      if (result.error) return ApiResponse.error(res, result.error, 400);
      validatedPromo = result.promo;
    }

    let validatedLoyaltyPoints = 0;
    if (loyaltyPointsToRedeem > 0) {
      const { rows: lpRows } = await pool.query(`SELECT balance FROM loyalty_points WHERE user_id = $1`, [userId]);
      validatedLoyaltyPoints = Math.min(Math.floor(loyaltyPointsToRedeem), lpRows[0]?.balance ?? 0);
    }

    const itemsByStore = {};
    for (const item of cart.cart_items) {
      const sid = item.products.store_id;
      if (!itemsByStore[sid]) itemsByStore[sid] = [];
      itemsByStore[sid].push(item);
    }

    const createdOrders = [];
    for (const [storeId, items] of Object.entries(itemsByStore)) {
      const order = await processStoreOrder({ storeId, items, cart, req, userId, validatedPromo, validatedLoyaltyPoints, pool });
      createdOrders.push({ ...order });
    }

    if (validatedPromo) {
      await pool.query(`UPDATE promo_codes SET uses_count = uses_count + 1 WHERE id = $1`, [validatedPromo.id]);
      await pool.query(`INSERT INTO promo_code_uses (code_id, user_id, order_id) VALUES ($1, $2, $3)`, [validatedPromo.id, userId, createdOrders[0].id]);
    }

    await repositories.carts.clearCart(userId);

    ApiResponse.withEntity(res, 'orders', createdOrders, 'Order(s) created successfully', null, 201);
    res.locals._orderCount = createdOrders.length;
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

    const limitNum = Number.parseInt(limit);
    const offsetNum = Number.parseInt(offset);

    const { data: orders, count: totalCount } = await repositories.orders.getBuyerOrders(userId, {
      status,
      limit: limitNum,
      offset: offsetNum
    });

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    ApiResponse.paginated(res, orders, {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: currentPage,
      itemsPerPage: limitNum,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
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
      return ApiResponse.error(res, 'Store not found', 404);
    }

    if (store.owner_id !== userId) {
      // Allow admins to view any store's orders
      const isAdmin = req.user.roles?.includes('admin');
      if (!isAdmin) {
        return ApiResponse.error(res, 'Not authorized to view these orders', 403);
      }
    }

    const limitNum = Number.parseInt(limit);
    const offsetNum = Number.parseInt(offset);

    const { data: orders, count: totalCount } = await repositories.orders.getStoreOrders(storeId, {
      status,
      limit: limitNum,
      offset: offsetNum
    });

    const currentPage = Math.floor(offsetNum / limitNum) + 1;
    const totalPages = Math.ceil(totalCount / limitNum);

    ApiResponse.paginated(res, orders, {
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: currentPage,
      itemsPerPage: limitNum,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
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
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Fast checks first â€” use the store data already embedded in the join result
    // to avoid an extra DB round-trip for every order fetch.
    const isBuyer = order.buyer_id === userId;
    const isSeller = order.store?.owner_id === userId;   // store is already joined

    // Only hit the DB for the admin role check when the cheap checks fail
    const isAdmin = (!isBuyer && !isSeller)
      ? await repositories.users.hasRole(userId, 'admin')
      : false;

    if (!isBuyer && !isSeller && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to view this order', 403);
    }

    ApiResponse.withEntity(res, 'order', order);
  } catch (error) {
    next(error);
  }
};

async function notifyOneDriver(drv, store, newDelivery, deliveryFeeVal) {
  try {
    await notificationService.sendPushNotification({
      userId: drv.user_id,
      title: 'New Delivery Request Available!',
      body: `New delivery request from ${store.store_name} in ${store.city} is available near you!`,
      data: { screen: 'driver_dashboard', deliveryId: newDelivery.id }
    });
    if (drv.email) {
      await notificationService.sendEmail({
        to: drv.email,
        subject: 'New Delivery Request Available!',
        html: `<div style="font-family: sans-serif; padding: 20px; color: #0F172A; max-width: 600px; margin: auto; border: 1px solid #E2E8F0; border-radius: 12px;"><h2 style="color: #0C1559; border-bottom: 2px solid #F1F5F9; padding-bottom: 10px;">New Delivery Request</h2><p style="font-size: 16px; line-height: 24px;">Hello <strong>${drv.full_name}</strong>,</p><p style="font-size: 15px; line-height: 24px;">A new delivery request is available near you at <strong>${store.store_name}</strong> in ${store.city}!</p><p style="font-size: 15px; margin: 20px 0;"><strong>Delivery Fee:</strong> ₵${deliveryFeeVal.toFixed(2)}</p><p style="margin-top: 30px; text-align: center;"><a href="${process.env.FRONTEND_URL || 'https://shopyos.com'}/driver/dashboard" style="background: #84cc16; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Open Dashboard</a></p></div>`,
        text: `Hello ${drv.full_name}, a new delivery request is available near you at ${store.store_name}. Open the Shopyos Driver app to accept!`
      });
    }
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

async function notifyNearbyDrivers(store, newDelivery, deliveryFeeVal) {
  try {
    const onlineDrivers = await repositories.drivers.getOnlineDrivers();
    const driversInRange = onlineDrivers.filter(drv => {
      if (!store.latitude || !store.longitude || !drv.latitude || !drv.longitude) return false;
      const dist = haversineKm(
        Number.parseFloat(store.latitude), Number.parseFloat(store.longitude),
        Number.parseFloat(drv.latitude), Number.parseFloat(drv.longitude)
      );
      return dist <= 10;
    });
    logger.info(`Found ${driversInRange.length} online drivers within 10 km of ${store.store_name}`);
    for (const drv of driversInRange) {
      await notifyOneDriver(drv, store, newDelivery, deliveryFeeVal);
    }
  } catch (listErr) {
    logger.error(`Failed to fetch online drivers or dispatch notifications:`, listErr.message);
  }
}

async function createAndDispatchDelivery(order, store, orderId) {
  const existingDelivery = await repositories.deliveries.findByOrderId(orderId);
  if (existingDelivery) return;
  const deliveryFeeVal = Number.parseFloat(order.delivery_fee || 0);
  const newDelivery = await repositories.deliveries.createDelivery({
    orderId,
    pickupAddress: store.address_line1 || 'Store Address',
    deliveryAddress: order.delivery_address_line1 || order.delivery_address || 'Customer Address',
    pickupLatitude: store.latitude || 0,
    pickupLongitude: store.longitude || 0,
    deliveryLatitude: order.delivery_latitude || 0,
    deliveryLongitude: order.delivery_longitude || 0,
    deliveryFee: deliveryFeeVal,
    driverEarnings: deliveryFeeVal * ((await feeConfigService.get('driver_earnings_percentage')) / 100)
  });
  logger.info(`Automatically created delivery for order ${order.order_number}`);
  await notifyNearbyDrivers(store, newDelivery, deliveryFeeVal);
}

async function handleOrderCompletion(order, status) {
  if (status !== 'delivered' && status !== 'completed') return;
  const buyer = await repositories.users.findById(order.buyer_id);
  if (buyer?.email) {
    rabbitMQService.publishMessage('email', {
      eventType: 'ORDER_DELIVERED',
      userId: order.buyer_id,
      role: 'buyer',
      email: buyer.email,
      referenceId: order.id,
      templateData: { orderId: order.order_number, amount: order.total_amount }
    });
  }
  if (status === 'completed') {
    setImmediate(async () => {
      try {
        await creditPoints(order.buyer_id, order.id, order.subtotal || order.total_amount, getPool());
        logger.info(`[Loyalty] Credited points for order ${order.order_number}`);
      } catch (e) {
        logger.error('[Loyalty] creditPoints failed:', e.message);
      }
    });
  }
}

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
      const err = { error: 'Invalid status', validStatuses };
      return ApiResponse.error(res, 'Invalid status', 400, err);
    }

    // Get order
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Verify authorization (store owner or admin)
    const store = await repositories.stores.findById(order.store_id);
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isSeller && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to update this order', 403);
    }

    // Enforce role boundary: sellers cannot set orders to in_transit, delivered, or completed
    if (isSeller && !isAdmin) {
      const forbiddenStatusesForSeller = ['in_transit', 'delivered', 'completed'];
      if (forbiddenStatusesForSeller.includes(status)) {
        return ApiResponse.error(res, `Sellers are not authorized to update order status to ${status}. This is managed by the delivery flow.`, 403);
      }
    }

    // Update status
    const updatedOrder = await repositories.orders.updateStatus(orderId, status);

    if (status === 'ready_for_pickup') {
      try {
        await createAndDispatchDelivery(order, store, orderId);
      } catch (deliveryErr) {
        logger.error(`Failed to automatically create delivery for order ${order.order_number}:`, deliveryErr.message);
      }
    }

    await notificationService.sendOrderNotification(order.buyer_id, order, status);
    await handleOrderCompletion(order, status);

    const { cacheDelPattern } = require('../config/redis');
    if (cacheDelPattern) {
      await cacheDelPattern(`shopyos:stores:dashboard:${order.store_id}*`);
      await cacheDelPattern(`shopyos:stores:analytics:${order.store_id}*`);
    }

    ApiResponse.withEntity(res, 'order', updatedOrder, 'Order status updated');
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
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Verify authorization
    const store = await repositories.stores.findById(order.store_id);
    const isSeller = store?.owner_id === userId;
    const isBuyer = order.buyer_id === userId;
    const isAdmin = (!isBuyer && !isSeller)
      ? await repositories.users.hasRole(userId, 'admin')
      : false;

    if (!isBuyer && !isSeller && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to cancel this order', 403);
    }

    // Buyers can only cancel while the order is still 'pending'.
    // Sellers and admins retain a broader window (pending → confirmed).
    const cancellableStatuses = (isBuyer && !isAdmin)
      ? ['pending']
      : ['pending', 'paid', 'confirmed'];

    if (!cancellableStatuses.includes(order.status)) {
      return ApiResponse.error(res, isBuyer
        ? 'Orders can only be cancelled while they are pending'
        : `Order cannot be cancelled in '${order.status}' status`, 400);
    }

    // Buyers have a 5-minute cancellation window after placing the order.
    // Sellers and admins are not time-constrained.
    const CANCEL_WINDOW_MINUTES = 5;
    if (isBuyer && !isAdmin) {
      const ageMinutes = (Date.now() - new Date(order.created_at).getTime()) / 60000;
      if (ageMinutes > CANCEL_WINDOW_MINUTES) {
        return ApiResponse.error(res, `Orders can only be cancelled within ${CANCEL_WINDOW_MINUTES} minutes of placing. Please contact the seller to request a cancellation.`, 400);
      }
    }

    // Cancel order & handle refund deductions based on payment status
    let refundMessage = '';
    const updateFields = {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || 'Cancelled by user'
    };

    if (order.status === 'paid' || order.status === 'confirmed') {
      const subtotal = Number.parseFloat(order.subtotal || 0);
      const discount = Number.parseFloat(order.discount_amount || 0);
      const refundAmount = Math.max(0, subtotal - discount);

      updateFields.escrow_status = 'REFUNDED';
      refundMessage = ` Refund of GHS ${refundAmount.toFixed(2)} processed (delivery fee of GHS ${Number.parseFloat(order.delivery_fee || 0).toFixed(2)} is non-refundable).`;
    }

    const cancelledOrder = await repositories.orders.update(orderId, updateFields);

    ApiResponse.withEntity(res, 'order', cancelledOrder, `Order cancelled successfully.${refundMessage}`);
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
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Verify access
    const store = await repositories.stores.findById(order.store_id);
    const isBuyer = order.buyer_id === userId;
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to view this order', 403);
    }

    // Get full details
    const orderDetails = await repositories.orders.getOrderDetails(order.id);

    ApiResponse.withEntity(res, 'order', orderDetails);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/orders/:orderId/verify-payment
 * @desc    Simulate and verify payment (DEVELOPMENT ONLY â€” use Paystack webhooks in production)
 * @access  Private
 */
const verifyPayment = async (req, res, next) => {
  // â”€â”€ Guard: this endpoint is dev-only â”€â”€
  if (process.env.NODE_ENV === 'production') {
    return ApiResponse.error(res, 'This endpoint is not available in production. Use the Paystack payment flow instead.', 404);
  }

  try {
    const { orderId } = req.params;
    const { status = 'success', paymentId = 'SIM-' + Date.now() } = req.body;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    if (order.buyer_id !== userId) {
      return ApiResponse.error(res, 'Not authorized', 403);
    }

    if (status !== 'success') {
      return ApiResponse.error(res, 'Payment failed simulation', 400);
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

    ApiResponse.withEntity(res, 'order', updatedOrder, 'Payment verified successfully');
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
    if (!order) return ApiResponse.error(res, 'Order not found', 404);

    if (order.buyer_id !== userId) return ApiResponse.error(res, 'Not authorized', 403);

    if (order.escrow_status !== 'HELD') {
       return ApiResponse.error(res, 'Funds are not currently held in escrow for this order', 400);
    }

    // Atomic delivery confirmation via RPC
    const { data: rpcResult, error: rpcError } = await repositories.orders.db.rpc('confirm_delivery_atomic', {
      p_order_id: orderId,
      p_user_id: userId,
      p_is_admin: req.user.roles?.includes('admin') || false
    });

    if (rpcError) throw rpcError;
    if (!rpcResult.success) {
      return ApiResponse.error(res, rpcResult.error || 'Delivery confirmation failed', 400);
    }

    // Fetch updated order for response and notifications
    const updatedOrder = await repositories.orders.getOrderDetails(orderId);

    // Notify seller
    if (updatedOrder?.store?.owner_id) {
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

    ApiResponse.withEntity(res, 'order', updatedOrder, 'Delivery confirmed. Funds released to seller and driver.');
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
