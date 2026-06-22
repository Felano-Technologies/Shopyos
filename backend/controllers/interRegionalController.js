// controllers/interRegionalController.js
const repositories = require('../db/repositories');
const feeConfigService = require('../services/feeConfigService');
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
  // Let's create a delivery record for the driver app to pick up
  const deliveryData = {
    order_id: order.id,
    pickup_address: order.delivery_address_line1, // normally hub address, but we can set it
    delivery_address: order.delivery_address_line1,
    status: 'pending',
    delivery_fee: fee,
    driver_earnings: Number((fee * 0.85).toFixed(2)) // 85% split default
  };
  return repositories.deliveries.create(deliveryData);
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
