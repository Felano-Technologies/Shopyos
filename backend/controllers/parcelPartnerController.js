// controllers/parcelPartnerController.js
const repositories = require('../db/repositories');
const notificationService = require('../services/notificationService');
const { getPool } = require('../config/postgres');

const getHubs = async (req, res, next) => {
  try {
    const hubs = await repositories.parcelPartner.getHubs();
    res.status(200).json({ success: true, data: hubs });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const { hubId } = req.query;
    if (!hubId) return res.status(400).json({ success: false, error: 'hubId is required' });

    const pool = getPool();
    const stats = await queryHubStats(pool, hubId);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

const getHubParcels = async (req, res, next) => {
  try {
    const { hubId, status } = req.query;
    if (!hubId) return res.status(400).json({ success: false, error: 'hubId is required' });

    const pool = getPool();
    const parcels = await queryHubParcels(pool, hubId, status);
    res.status(200).json({ success: true, data: parcels });
  } catch (error) {
    next(error);
  }
};

const checkInParcel = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { hubId, notes, photoUrl } = req.body;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const hub = await repositories.parcelPartner.getHubById(hubId);
    if (!hub) return res.status(404).json({ success: false, error: 'Hub not found' });

    const trackingNum = `SPY-PRC-${orderId.substring(0, 8).toUpperCase()}`;
    await updateOrderOnCheckIn(orderId, trackingNum);

    await repositories.parcelPartner.createStatusLog(orderId, 'at_origin_hub', hubId, userId, notes, photoUrl);
    await notifyBuyerCheckIn(order, hub);

    res.status(200).json({ success: true, message: 'Parcel checked in successfully', trackingNumber: trackingNum });
  } catch (error) {
    next(error);
  }
};

const dispatchParcel = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { hubId, notes, photoUrl } = req.body;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const hub = await repositories.parcelPartner.getHubById(hubId);
    const destHub = await repositories.parcelPartner.getHubById(order.destination_hub_id);

    const estArrival = await calculateEstArrival(hub?.region_name, destHub?.region_name);
    await updateOrderOnDispatch(orderId, estArrival);

    await repositories.parcelPartner.createStatusLog(orderId, 'in_transit_regional', hubId, userId, notes, photoUrl);
    await notifyBuyerDispatch(order, estArrival);

    res.status(200).json({ success: true, message: 'Parcel dispatched successfully', estimatedArrival: estArrival });
  } catch (error) {
    next(error);
  }
};

const arriveParcel = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { hubId, notes, photoUrl } = req.body;
    const userId = req.user.id;

    const order = await repositories.orders.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const hub = await repositories.parcelPartner.getHubById(hubId);
    if (!hub) return res.status(404).json({ success: false, error: 'Hub not found' });

    await updateOrderOnArrival(orderId);
    await repositories.parcelPartner.createStatusLog(orderId, 'at_destination_hub', hubId, userId, notes, photoUrl);
    await notifyBuyerArrival(order, hub);

    res.status(200).json({ success: true, message: 'Parcel marked as arrived at destination hub' });
  } catch (error) {
    next(error);
  }
};

// --- Helper Functions to keep action methods under 30 lines ---

async function queryHubStats(pool, hubId) {
  const { rows: pending } = await pool.query(
    "SELECT COUNT(*) FROM orders WHERE origin_hub_id = $1 AND status = 'ready_for_pickup'", [hubId]
  );
  const { rows: checkIn } = await pool.query(
    "SELECT COUNT(*) FROM orders WHERE origin_hub_id = $1 AND status = 'at_origin_hub'", [hubId]
  );
  const { rows: transit } = await pool.query(
    "SELECT COUNT(*) FROM orders WHERE origin_hub_id = $1 AND status = 'in_transit_regional'", [hubId]
  );
  const { rows: arrived } = await pool.query(
    "SELECT COUNT(*) FROM orders WHERE destination_hub_id = $1 AND status = 'at_destination_hub'", [hubId]
  );
  return {
    awaitingCheckIn: parseInt(pending[0]?.count || 0),
    checkedIn: parseInt(checkIn[0]?.count || 0),
    inTransit: parseInt(transit[0]?.count || 0),
    arrived: parseInt(arrived[0]?.count || 0)
  };
}

async function queryHubParcels(pool, hubId, status) {
  let query = `
    SELECT o.*, s.store_name, s.logo_url as store_logo
    FROM orders o
    LEFT JOIN stores s ON o.store_id = s.id
  `;
  const params = [];

  if (status === 'at_destination_hub') {
    params.push(hubId, status);
    query += ` WHERE o.destination_hub_id = $1 AND o.status = $2`;
  } else {
    params.push(hubId);
    query += ` WHERE o.origin_hub_id = $1`;
    if (status) {
      params.push(status);
      query += ` AND o.status = $2`;
    } else {
      query += ` AND o.status IN ('ready_for_pickup', 'at_origin_hub', 'in_transit_regional')`;
    }
  }

  query += ` ORDER BY o.created_at DESC`;
  const { rows } = await pool.query(query, params);
  return rows;
}

async function updateOrderOnCheckIn(orderId, trackingNum) {
  const pool = getPool();
  await pool.query(
    "UPDATE orders SET parcel_tracking_number = $1, status = 'at_origin_hub', updated_at = NOW() WHERE id = $2",
    [trackingNum, orderId]
  );
}

async function updateOrderOnDispatch(orderId, estArrival) {
  const pool = getPool();
  await pool.query(
    "UPDATE orders SET estimated_hub_arrival = $1, status = 'in_transit_regional', updated_at = NOW() WHERE id = $2",
    [estArrival, orderId]
  );
}

async function updateOrderOnArrival(orderId) {
  const pool = getPool();
  await pool.query(
    "UPDATE orders SET status = 'at_destination_hub', updated_at = NOW() WHERE id = $1",
    [orderId]
  );
}

async function calculateEstArrival(origin, dest) {
  if (!origin || !dest) return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const config = await repositories.parcelPartner.getTransitConfig(origin, dest);
  const days = config ? config.transit_days_min : 3;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

async function notifyBuyerCheckIn(order, hub) {
  await notificationService.sendNotification({
    userId: order.buyer_id,
    type: 'order_status_update',
    title: 'Parcel Checked In',
    message: `Your parcel from order #${order.order_number} has been received at the origin hub: ${hub.hub_name}.`,
    relatedId: order.id,
    relatedType: 'order'
  });
}

async function notifyBuyerDispatch(order, estArrival) {
  await notificationService.sendNotification({
    userId: order.buyer_id,
    type: 'order_status_update',
    title: 'Parcel Dispatched',
    message: `Your parcel from order #${order.order_number} is in transit. Estimated arrival: ${estArrival}.`,
    relatedId: order.id,
    relatedType: 'order'
  });
}

async function notifyBuyerArrival(order, hub) {
  await notificationService.sendNotification({
    userId: order.buyer_id,
    type: 'order_status_update',
    title: 'Parcel Arrived at Hub',
    message: `Your parcel from order #${order.order_number} has arrived at the destination hub: ${hub.hub_name}. You can pick it up or request last-mile delivery.`,
    relatedId: order.id,
    relatedType: 'order'
  });
}

// ─── Admin Hub Management ──────────────────────────────────────────────────

const adminGetAllHubs = async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT h.*, r.name as region_name, r.code as region_code
       FROM parcel_partner_hubs h
       LEFT JOIN ghana_regions r ON h.region_id = r.id
       ORDER BY h.hub_name`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

const adminCreateHub = async (req, res, next) => {
  try {
    const { regionId, hubName, partnerName, address, phone, latitude, longitude } = req.body;
    if (!regionId || !hubName || !partnerName) {
      return res.status(400).json({ success: false, error: 'regionId, hubName and partnerName are required' });
    }
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [regionId, hubName, partnerName, address || null, phone || null, latitude || null, longitude || null]
    );
    res.status(201).json({ success: true, hub: rows[0] });
  } catch (error) {
    next(error);
  }
};

const adminUpdateHub = async (req, res, next) => {
  try {
    const { hubId } = req.params;
    const { hubName, partnerName, address, phone, latitude, longitude } = req.body;
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE parcel_partner_hubs
       SET hub_name = COALESCE($1, hub_name),
           partner_name = COALESCE($2, partner_name),
           address = COALESCE($3, address),
           phone = COALESCE($4, phone),
           latitude = COALESCE($5, latitude),
           longitude = COALESCE($6, longitude),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [hubName, partnerName, address, phone, latitude, longitude, hubId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Hub not found' });
    res.status(200).json({ success: true, hub: rows[0] });
  } catch (error) {
    next(error);
  }
};

const adminToggleHub = async (req, res, next) => {
  try {
    const { hubId } = req.params;
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE parcel_partner_hubs SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING id, hub_name, is_active`,
      [hubId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Hub not found' });
    res.status(200).json({ success: true, hub: rows[0] });
  } catch (error) {
    next(error);
  }
};

const adminGetTransitRoutes = async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, origin_region, dest_region, transit_days_min, transit_days_max,
              route_fee AS transit_fee, is_active, created_at, updated_at
       FROM parcel_transit_config ORDER BY origin_region, dest_region`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

const adminUpsertTransitRoute = async (req, res, next) => {
  try {
    const { originRegion, destRegion, transitDaysMin, transitDaysMax, transitFee } = req.body;
    if (!originRegion || !destRegion) {
      return res.status(400).json({ success: false, error: 'originRegion and destRegion are required' });
    }
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO parcel_transit_config (origin_region, dest_region, transit_days_min, transit_days_max, route_fee)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (origin_region, dest_region)
       DO UPDATE SET transit_days_min = $3, transit_days_max = $4, route_fee = $5, updated_at = NOW()
       RETURNING id, origin_region, dest_region, transit_days_min, transit_days_max,
                 route_fee AS transit_fee, is_active, created_at, updated_at`,
      [originRegion, destRegion, transitDaysMin || 3, transitDaysMax || 5, transitFee || 0]
    );
    res.status(200).json({ success: true, route: rows[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHubs,
  getDashboardStats,
  getHubParcels,
  checkInParcel,
  dispatchParcel,
  arriveParcel,
  adminGetAllHubs,
  adminCreateHub,
  adminUpdateHub,
  adminToggleHub,
  adminGetTransitRoutes,
  adminUpsertTransitRoute,
};
