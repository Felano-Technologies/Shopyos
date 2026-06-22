// controllers/interRegionalController.js
const repositories = require('../db/repositories');
const feeConfigService = require('../services/feeConfigService');
const notificationService = require('../services/notificationService');
const { haversineKm } = require('../utils/distance');
const { logger } = require('../config/logger');
const { getPool } = require('../config/postgres');

const requestLastMile = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.buyer_id !== userId) return res.status(403).json({ success: false, error: 'Unauthorized' });

    if (order.status !== 'at_destination_hub') {
      return res.status(400).json({ success: false, error: 'Order must be at destination hub' });
    }

    const lastMileFee = await feeConfigService.get('last_mile_default_fee');
    const delivery = await createLastMileDeliveryRecord(order, lastMileFee);

    await updateOrderLastMile(orderId, lastMileFee, delivery.id);

    res.status(200).json({
      success: true,
      message: 'Last-mile delivery requested successfully',
      fee: lastMileFee,
      deliveryId: delivery.id
    });
  } catch (error) {
    next(error);
  }
};

const getTransitInfo = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.buyer_id !== userId && order.store_id !== req.user.storeId && !req.user.roles?.includes('parcel_partner') && !req.user.roles?.includes('admin')) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const history = await repositories.parcelPartner.getStatusHistory(orderId);
    const originHub = order.origin_hub_id ? await repositories.parcelPartner.getHubById(order.origin_hub_id) : null;
    const destHub = order.destination_hub_id ? await repositories.parcelPartner.getHubById(order.destination_hub_id) : null;

    res.status(200).json({
      success: true,
      data: {
        trackingNumber: order.parcel_tracking_number,
        orderStatus: order.status,
        originHub,
        destinationHub: destHub,
        estimatedHubArrival: order.estimated_hub_arrival,
        lastMileRequested: order.last_mile_requested,
        lastMileFee: order.last_mile_fee,
        history
      }
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
