// controllers/interRegionalController.js
const repositories = require('../db/repositories');
const feeConfigService = require('../services/feeConfigService');
const notificationService = require('../services/notificationService');
const { haversineKm } = require('../utils/distance');
const { logger } = require('../config/logger');
const { getPool } = require('../config/postgres');
const ApiResponse = require('../utils/apiResponse');
const { emitTransitUpdate } = require('../services/transitEvents');

const requestLastMile = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return ApiResponse.error(res, 'Order not found', 404);
    if (order.buyer_id !== userId) return ApiResponse.error(res, 'Unauthorized', 403);

    if (order.status !== 'at_destination_hub') {
      return ApiResponse.error(res, 'Order must be at destination hub', 400);
    }

    const lastMileFee = await feeConfigService.get('last_mile_default_fee');
    const delivery = await createLastMileDeliveryRecord(order, lastMileFee);

    await updateOrderLastMile(orderId, lastMileFee, delivery.id);
    await emitTransitUpdate(orderId);

    ApiResponse.success(res, { fee: lastMileFee, deliveryId: delivery.id }, 'Last-mile delivery requested successfully');
  } catch (error) {
    next(error);
  }
};

const getTransitInfo = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return ApiResponse.error(res, 'Order not found', 404);
    if (order.buyer_id !== userId && order.store_id !== req.user.storeId && !req.user.roles?.includes('parcel_partner') && !req.user.roles?.includes('admin')) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    const history = await repositories.parcelPartner.getStatusHistory(orderId);
    const originHub = order.origin_hub_id ? await repositories.parcelPartner.getHubById(order.origin_hub_id) : null;
    const destHub = order.destination_hub_id ? await repositories.parcelPartner.getHubById(order.destination_hub_id) : null;

    // Endpoints for the schematic map (store -> origin hub -> dest hub -> home).
    const store = order.store_id ? await repositories.stores.findById(order.store_id) : null;

    // Driver legs — the tracker shows a live marker only while one is active.
    const firstMile = await repositories.deliveries.findByOrderIdAndLeg(orderId, 'first_mile').catch(() => null);
    const lastMile = await repositories.deliveries.findByOrderIdAndLeg(orderId, 'last_mile').catch(() => null);
    const legSummary = (d) => (d ? { deliveryId: d.id, status: d.status, driverId: d.driver_id || null } : null);

    ApiResponse.success(res, {
      orderId: order.id,
      trackingNumber: order.parcel_tracking_number,
      orderStatus: order.status,
      originHub,
      destinationHub: destHub,
      estimatedHubArrival: order.estimated_hub_arrival,
      lastMileRequested: order.last_mile_requested,
      lastMileFee: order.last_mile_fee,
      store: store ? { name: store.store_name, latitude: store.latitude, longitude: store.longitude } : null,
      destination: {
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        address: order.delivery_address_line1 || order.delivery_address || null,
      },
      firstMileLeg: legSummary(firstMile),
      lastMileLeg: legSummary(lastMile),
      history
    });
  } catch (error) {
    next(error);
  }
};

// --- Helper Functions to keep action methods under 30 lines ---

async function createLastMileDeliveryRecord(order, fee) {
  const destHub = order.destination_hub_id
    ? await repositories.parcelPartner.getHubById(order.destination_hub_id)
    : null;

  const earningsPct = (await feeConfigService.get('driver_earnings_percentage') || 85) / 100;

  const delivery = await repositories.deliveries.createDelivery({
    orderId: order.id,
    leg: 'last_mile',
    pickupAddress: destHub?.address || 'Destination Hub',
    pickupLatitude: destHub?.latitude || 0,
    pickupLongitude: destHub?.longitude || 0,
    deliveryAddress: order.delivery_address_line1 || order.delivery_address || 'Customer Address',
    deliveryLatitude: order.delivery_latitude || 0,
    deliveryLongitude: order.delivery_longitude || 0,
    status: 'unassigned',
    deliveryFee: fee,
    driverEarnings: Number((fee * earningsPct).toFixed(2))
  });

  await notifyLastMileDrivers(destHub, delivery, fee);
  return delivery;
}

async function notifyLastMileDrivers(hub, delivery, fee) {
  try {
    const onlineDrivers = await repositories.drivers.getOnlineDrivers();
    const driversInRange = onlineDrivers.filter(drv => {
      if (!hub?.latitude || !hub?.longitude || !drv.latitude || !drv.longitude) return false;
      return haversineKm(
        Number.parseFloat(hub.latitude), Number.parseFloat(hub.longitude),
        Number.parseFloat(drv.latitude), Number.parseFloat(drv.longitude)
      ) <= 10;
    });
    logger.info(`Last-mile: found ${driversInRange.length} drivers within 10km of hub`);
    for (const drv of driversInRange) {
      await notificationService.sendPushNotification({
        userId: drv.user_id,
        title: 'Last-Mile Delivery Available!',
        body: `Pickup from ${hub?.hub_name || 'parcel hub'} — ₵${Number(fee).toFixed(2)} delivery fee.`,
        data: { screen: 'driver_dashboard', deliveryId: delivery.id }
      }).catch(err => logger.error(`Failed to notify driver ${drv.user_id}:`, err.message));
    }
  } catch (err) {
    logger.error('Failed to notify last-mile drivers:', err.message);
  }
}

async function updateOrderLastMile(orderId, fee, deliveryId) {
  const pool = getPool();
  await pool.query(
    `UPDATE orders 
     SET last_mile_requested = TRUE, 
         last_mile_fee = $1, 
         last_mile_delivery_id = $2, 
         status = 'awaiting_last_mile',
         updated_at = NOW() 
     WHERE id = $3`,
    [fee, deliveryId, orderId]
  );
}

module.exports = {
  requestLastMile,
  getTransitInfo
};
