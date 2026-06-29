// controllers/deliveryController.js
// Delivery tracking and management controller

const ApiResponse = require('../utils/apiResponse');
const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');
const rabbitMQService = require('../services/rabbitmq');

/**
 * @route   POST /api/deliveries/create
 * @desc    Create delivery for order (Admin/Seller)
 * @access  Private (Admin/Seller)
 */
const createDelivery = async (req, res, next) => {
  try {
    const {
      orderId,
      pickupAddress,
      deliveryAddress,
      pickupLatitude,
      pickupLongitude,
      deliveryLatitude,
      deliveryLongitude,
      estimatedPickupTime,
      estimatedDeliveryTime
    } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!orderId || !pickupAddress || !deliveryAddress) {
      return ApiResponse.error(res, 'Order ID, pickup address, and delivery address are required', 400);
    }

    // Verify order exists and user has permission
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Verify seller owns the store or is admin
    const store = await repositories.stores.findById(order.store_id);
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isSeller && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to create delivery for this order', 403);
    }

    // Check if delivery already exists
    const existingDelivery = await repositories.deliveries.findByOrderId(orderId);
    if (existingDelivery) {
      return ApiResponse.error(res, 'Delivery already exists for this order', 400);
    }

    // Create delivery
    const delivery = await repositories.deliveries.createDelivery({
      orderId,
      pickupAddress,
      deliveryAddress,
      pickupLatitude,
      pickupLongitude,
      deliveryLatitude,
      deliveryLongitude,
      estimatedPickupTime,
      estimatedDeliveryTime
    });

    ApiResponse.withEntity(res, 'delivery', delivery, 'Delivery created successfully', null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/available
 * @desc    Get available deliveries (for drivers)
 * @access  Private (Driver)
 */
const getAvailableDeliveries = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const deliveries = await repositories.deliveries.getAvailableDeliveries({
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset)
    });

    ApiResponse.success(res, { deliveries, count: deliveries.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/deliveries/:deliveryId/assign
 * @desc    Assign driver to delivery
 * @access  Private (Driver)
 */
const assignDriver = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const driverId = req.user.id;

    // Verify delivery exists and is available
    const delivery = await repositories.deliveries.findById(deliveryId);
    if (!delivery) {
      return ApiResponse.error(res, 'Delivery not found', 404);
    }

    if (delivery.driver_id) {
      return ApiResponse.error(res, 'Delivery already assigned to another driver', 400);
    }

    if (delivery.status !== 'unassigned') {
      return ApiResponse.error(res, `Delivery cannot be assigned in ${delivery.status} status`, 400);
    }

    // Assign driver
    const updatedDelivery = await repositories.deliveries.assignDriver(deliveryId, driverId);

    // Get order details for notification
    const order = await repositories.orders.findById(delivery.order_id);
    const driver = await repositories.users.findById(driverId);

    // Notify customer that driver has been assigned (if driver is not the buyer)
    if (order && driver && order.buyer_id !== driverId) {
      await notificationService.sendOrderNotification(order.buyer_id, order, 'assigned');
    }

    ApiResponse.withEntity(res, 'delivery', updatedDelivery, 'Delivery assigned successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/my-deliveries
 * @desc    Get driver's deliveries
 * @access  Private (Driver)
 */
const getMyDeliveries = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    const deliveries = await repositories.deliveries.getDriverDeliveries(driverId, {
      status,
      limit: Number.parseInt(limit),
      offset: Number.parseInt(offset)
    });

    ApiResponse.success(res, { deliveries, count: deliveries.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/active
 * @desc    Get driver's active deliveries
 * @access  Private (Driver)
 */
const getActiveDeliveries = async (req, res, next) => {
  try {
    const driverId = req.user.id;

    const deliveries = await repositories.deliveries.getActiveDeliveries(driverId);

    ApiResponse.success(res, { deliveries, count: deliveries.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/:deliveryId
 * @desc    Get delivery details
 * @access  Private
 */
const getDeliveryDetails = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);

    if (!delivery) {
      return ApiResponse.error(res, 'Delivery not found', 404);
    }

    // Verify access (buyer, seller, driver, or admin)
    const isBuyer = delivery.order.buyer_id === userId;
    const isSeller = delivery.order.store.owner_id === userId;
    const isDriver = delivery.driver_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isDriver && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to view this delivery', 403);
    }

    ApiResponse.withEntity(res, 'delivery', delivery);
  } catch (error) {
    next(error);
  }
};

const _VALID_DELIVERY_STATUSES = [
  'pending', 'assigned', 'picked_up', 'in_transit',
  'delivered', 'failed', 'cancelled'
];

async function _notifyPickedUp(order, driverId, updatedDelivery, verificationPin) {
  if (!order || order.buyer_id === driverId) return;
  await notificationService.sendNotification({
    userId: order.buyer_id,
    type: 'order_picked_up',
    title: 'Order Picked Up',
    message: `Your order #${order.order_number} has been picked up. Give this PIN to the driver upon delivery: ${verificationPin}`,
    relatedId: order.id,
    relatedType: 'order',
    data: { orderId: order.id, status: 'in_transit', verificationPin },
    push: { data: { screen: 'order', orderId: order.id } }
  });

  const buyer = await repositories.users.findById(order.buyer_id);
  if (buyer?.email) {
    rabbitMQService.publishMessage('email', {
      eventType: 'ORDER_PICKED_UP',
      userId: order.buyer_id,
      email: buyer.email,
      templateData: { orderNumber: order.order_number, verificationPin }
    });
  }

  const buyerProfile = await repositories.userProfiles.findByUserId(order.buyer_id);
  const buyerPhone = order.delivery_phone || buyerProfile?.phone;
  if (buyerPhone) {
    rabbitMQService.publishMessage('sms', {
      eventType: 'ORDER_PICKED_UP',
      userId: order.buyer_id,
      phone: buyerPhone,
      templateData: { orderNumber: order.order_number, verificationPin }
    });
  }
}

async function _handlePickedUp(order, driverId, updatedDelivery) {
  const verificationPin = Math.floor(100000 + Math.random() * 900000).toString();
  await repositories.orders.db.from('orders')
    .update({
      status: 'in_transit',
      verification_pin: verificationPin,
      updated_at: new Date().toISOString()
    })
    .eq('id', updatedDelivery.order_id);
  await _notifyPickedUp(order, driverId, updatedDelivery, verificationPin);
}

async function _handleDelivered(order, driverId, updatedDelivery) {
  await repositories.orders.updateStatus(updatedDelivery.order_id, 'delivered');
  if (!order || order.buyer_id === driverId) return;
  await notificationService.sendOrderNotification(order.buyer_id, order, 'delivered');
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
}

async function _handleFailedOrCancelled(order, driverId, status, updatedDelivery) {
  if (!order || order.buyer_id === driverId) return;
  const title = status === 'failed' ? 'Delivery Failed' : 'Delivery Cancelled';
  await notificationService.sendNotification({
    userId: order.buyer_id,
    type: 'delivery_issue',
    title,
    message: `There was an issue with your order #${order.order_number}. Please contact support.`,
    relatedId: updatedDelivery.id,
    relatedType: 'delivery',
    data: { orderId: order.id, deliveryId: updatedDelivery.id, status },
    push: { data: { screen: 'order', orderId: order.id } }
  });
}

async function _applyDeliveryStatusSideEffects(status, order, driverId, updatedDelivery) {
  if (status === 'picked_up') {
    await _handlePickedUp(order, driverId, updatedDelivery);
  } else if (status === 'in_transit') {
    if (order && order.buyer_id !== driverId) {
      await notificationService.sendOrderNotification(order.buyer_id, order, 'in_transit');
    }
  } else if (status === 'delivered') {
    await _handleDelivered(order, driverId, updatedDelivery);
  } else if (status === 'failed' || status === 'cancelled') {
    await _handleFailedOrCancelled(order, driverId, status, updatedDelivery);
  }
}

/**
 * @route   PUT /api/deliveries/:deliveryId/status
 * @desc    Update delivery status
 * @access  Private (Driver)
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;

    if (!_VALID_DELIVERY_STATUSES.includes(status)) {
      return ApiResponse.error(res, 'Invalid status', 400);
    }

    const isOwner = await repositories.deliveries.verifyDriverOwnership(deliveryId, driverId);
    if (!isOwner) {
      return ApiResponse.error(res, 'Not authorized to update this delivery', 403);
    }

    // Enforce role boundary: drivers must verify PIN via verify-pin endpoint, not direct status change
    if (status === 'delivered') {
      return ApiResponse.error(res, "To complete delivery, you must verify the customer's 6-digit PIN. Please use the verification endpoint.", 400);
    }

    const updatedDelivery = await repositories.deliveries.updateStatus(deliveryId, status);
    const order = await repositories.orders.findById(updatedDelivery.order_id);

    await _applyDeliveryStatusSideEffects(status, order, driverId, updatedDelivery);

    ApiResponse.withEntity(res, 'delivery', updatedDelivery, 'Delivery status updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/deliveries/:deliveryId/location
 * @desc    Add location update
 * @access  Private (Driver)
 */
const addLocationUpdate = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { latitude, longitude, notes } = req.body;
    const driverId = req.user.id;

    // Validate coordinates
    if (!latitude || !longitude) {
      return ApiResponse.error(res, 'Latitude and longitude are required', 400);
    }

    // Verify driver owns delivery
    const isOwner = await repositories.deliveries.verifyDriverOwnership(deliveryId, driverId);
    if (!isOwner) {
      return ApiResponse.error(res, 'Not authorized to update this delivery', 403);
    }

    // Add location update
    const locationUpdate = await repositories.deliveries.addLocationUpdate(deliveryId, {
      latitude: Number.parseFloat(latitude),
      longitude: Number.parseFloat(longitude),
      notes
    });

    // Push update to the customer watching this delivery + cache latest position
    try {
      const { getRedis, cacheSet } = require('../config/redis');

      await cacheSet(`delivery:location:${deliveryId}`, {
        latitude: Number.parseFloat(latitude),
        longitude: Number.parseFloat(longitude),
      }, 120);

      const delivery = await repositories.deliveries.findById(deliveryId);
      const buyerId = delivery?.order?.buyer_id;
      if (buyerId) {
        const redis = getRedis();
        const channel = process.env.REALTIME_EVENTS_CHANNEL || 'shopyos:realtime:events';
        if (redis?.status === 'ready') {
          await redis.publish(channel, JSON.stringify({
            scope: 'user',
            userId: buyerId,
            event: 'delivery:location_update',
            payload: { deliveryId, latitude: Number.parseFloat(latitude), longitude: Number.parseFloat(longitude) }
          }));
        }
      }
    } catch (socketErr) {
      console.error('[addLocationUpdate] Socket/cache emit failed:', socketErr.message);
    }

    ApiResponse.withEntity(res, 'locationUpdate', locationUpdate, 'Location updated', null, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/:deliveryId/location
 * @desc    Get location updates for delivery
 * @access  Private
 */
const getLocationUpdates = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { limit = 50 } = req.query;
    const userId = req.user.id;

    // Get delivery to verify access
    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);
    if (!delivery) {
      return ApiResponse.error(res, 'Delivery not found', 404);
    }

    // Verify access
    const isBuyer = delivery.order.buyer_id === userId;
    const isSeller = delivery.order.store.owner_id === userId;
    const isDriver = delivery.driver_id === userId;

    if (!isBuyer && !isSeller && !isDriver) {
      return ApiResponse.error(res, 'Not authorized to view location updates', 403);
    }

    const locationUpdates = await repositories.deliveries.getLocationUpdates(
      deliveryId,
      Number.parseInt(limit)
    );

    ApiResponse.success(res, { locationUpdates, count: locationUpdates.length });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/:deliveryId/latest-location
 * @desc    Get latest location for delivery
 * @access  Private
 */
const getLatestLocation = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user.id;

    // Get delivery to verify access
    const delivery = await repositories.deliveries.getDeliveryDetails(deliveryId);
    if (!delivery) {
      return ApiResponse.error(res, 'Delivery not found', 404);
    }

    // Verify access
    const isBuyer = delivery.order.buyer_id === userId;
    const isSeller = delivery.order.store.owner_id === userId;
    const isDriver = delivery.driver_id === userId;

    if (!isBuyer && !isSeller && !isDriver) {
      return ApiResponse.error(res, 'Not authorized to view location', 403);
    }

    const { cacheGet } = require('../config/redis');
    const cached = await cacheGet(`delivery:location:${deliveryId}`);
    const location = cached ?? await repositories.deliveries.getLatestLocation(deliveryId);

    ApiResponse.withEntity(res, 'location', location);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/order/:orderId
 * @desc    Get delivery by order ID
 * @access  Private
 */
const getDeliveryByOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Verify order access
    const order = await repositories.orders.findById(orderId);
    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    const store = await repositories.stores.findById(order.store_id);
    const isBuyer = order.buyer_id === userId;
    const isSeller = store.owner_id === userId;
    const isAdmin = await repositories.users.hasRole(userId, 'admin');

    if (!isBuyer && !isSeller && !isAdmin) {
      return ApiResponse.error(res, 'Not authorized to view this delivery', 403);
    }

    const delivery = await repositories.deliveries.findByOrderId(orderId);

    if (!delivery) {
      return ApiResponse.error(res, 'Delivery not found for this order', 404);
    }

    // Get full details
    const deliveryDetails = await repositories.deliveries.getDeliveryDetails(delivery.id);

    ApiResponse.withEntity(res, 'delivery', deliveryDetails);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deliveries/driver/stats
 * @desc    Get delivery statistics for driver
 * @access  Private (Driver)
 */
const getDriverStats = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const { view = 'weekly' } = req.query;

    const db = require('../config/postgres').getPool();
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthSummary, weekChart, monthChart, breakdown, rating] = await Promise.all([
      db.query(`
        SELECT
          COALESCE(SUM(d.driver_earnings), 0) AS total_earned_this_month,
          COUNT(d.id) AS total_deliveries_this_month
        FROM deliveries d
        WHERE d.driver_id = $1
          AND d.status = 'delivered'
          AND d.delivered_at >= $2
      `, [driverId, startOfMonth]),
      db.query(`
        SELECT
          TO_CHAR(d.delivered_at, 'Dy') AS label,
          COALESCE(SUM(d.driver_earnings), 0) AS earnings
        FROM deliveries d
        WHERE d.driver_id = $1
          AND d.status = 'delivered'
          AND d.delivered_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(d.delivered_at), TO_CHAR(d.delivered_at, 'Dy')
        ORDER BY DATE(d.delivered_at)
      `, [driverId]),
      db.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', d.delivered_at), 'Mon') AS label,
          COALESCE(SUM(d.driver_earnings), 0) AS earnings
        FROM deliveries d
        WHERE d.driver_id = $1
          AND d.status = 'delivered'
          AND d.delivered_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', d.delivered_at)
        ORDER BY DATE_TRUNC('month', d.delivered_at)
      `, [driverId]),
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN wl.transaction_type = 'earning' THEN wl.amount ELSE 0 END), 0) AS base_delivery_fees,
          COALESCE(SUM(CASE WHEN wl.transaction_type = 'referral_reward' THEN wl.amount ELSE 0 END), 0) AS bonuses_and_rewards
        FROM wallet_logs wl
        WHERE wl.user_id = $1
          AND wl.created_at >= $2
      `, [driverId, startOfMonth]),
      db.query(`
        SELECT
          COALESCE(AVG(dr.rating)::numeric(10,2), 0) AS average,
          COUNT(dr.id) AS total_reviews
        FROM driver_reviews dr
        WHERE dr.driver_id = $1
      `, [driverId]),
    ]);

    const summary = monthSummary.rows[0] || { total_earned_this_month: 0, total_deliveries_this_month: 0 };
    const totalDeliveries = parseInt(summary.total_deliveries_this_month, 10);
    const totalEarnedMonth = parseFloat(summary.total_earned_this_month);

    const chartRows = view === 'monthly' ? monthChart.rows : weekChart.rows;
    const chartLabels = chartRows.map(r => r.label) || [];
    const chartData = chartRows.map(r => parseFloat(r.earnings)) || [];

    const bd = breakdown.rows[0] || { base_delivery_fees: 0, bonuses_and_rewards: 0 };
    const baseFees = parseFloat(bd.base_delivery_fees);
    const bonuses = parseFloat(bd.bonuses_and_rewards);

    const r = rating.rows[0] || { average: 0, total_reviews: 0 };

    const [lifetimeResult] = await Promise.all([
      db.query(`
        SELECT COALESCE(SUM(driver_earnings), 0) AS total_earned_lifetime
        FROM deliveries
        WHERE driver_id = $1 AND status = 'delivered'
      `, [driverId]),
    ]);

    const totalLifetime = parseFloat(lifetimeResult.rows[0]?.total_earned_lifetime || 0);

    ApiResponse.success(res, {
      summary: {
        total_earned_lifetime: totalLifetime,
        total_earned_this_month: totalEarnedMonth,
        total_deliveries_this_month: totalDeliveries,
        avg_per_delivery: totalDeliveries > 0 ? totalEarnedMonth / totalDeliveries : 0,
      },
      chart: {
        labels: chartLabels,
        data: chartData,
      },
      breakdown: {
        base_delivery_fees: baseFees,
        bonuses_and_rewards: bonuses,
        total: baseFees + bonuses,
      },
      rating: {
        average: parseFloat(r.average),
        total_reviews: parseInt(r.total_reviews, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/deliveries/:deliveryId/verify-pin
 * @desc    Verify delivery PIN and release funds (Atomic)
 * @access  Private (Driver)
 */
const verifyDeliveryPin = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const { pin } = req.body;
    const driverId = req.user.id;

    if (!pin) {
      return ApiResponse.error(res, 'Verification PIN is required', 400);
    }

    const delivery = await repositories.deliveries.findById(deliveryId);
    if (!delivery) {
      return ApiResponse.error(res, 'Delivery not found', 404);
    }

    // Call atomic verification RPC
    const { data: result, error: rpcError } = await repositories.orders.db.rpc('verify_delivery_pin', {
      p_order_id: delivery.order_id,
      p_driver_id: driverId,
      p_pin: pin
    });

    if (rpcError) throw rpcError;
    if (!result.success) {
      return ApiResponse.error(res, result.error || 'Verification failed', 400);
    }

    // Notify customer
    const order = await repositories.orders.findById(delivery.order_id);
    if (order) {
      await notificationService.sendOrderNotification(order.buyer_id, order, 'delivered');
    }

    ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDelivery,
  getAvailableDeliveries,
  assignDriver,
  getMyDeliveries,
  getActiveDeliveries,
  getDeliveryDetails,
  updateDeliveryStatus,
  addLocationUpdate,
  getLocationUpdates,
  getLatestLocation,
  getDeliveryByOrder,
  getDriverStats,
  verifyDeliveryPin
};
