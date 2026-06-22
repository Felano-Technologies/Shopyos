// db/repositories/ParcelPartnerRepository.js
const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

class ParcelPartnerRepository extends BaseRepository {
  constructor(client) {
    super(client, 'parcel_partner_hubs');
  }

  async getHubs() {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT h.*, r.name as region_name, r.code as region_code 
       FROM parcel_partner_hubs h
       LEFT JOIN ghana_regions r ON h.region_id = r.id
       WHERE h.is_active = TRUE
       ORDER BY h.hub_name`
    );
    return rows;
  }

  async getHubById(hubId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT h.*, r.name as region_name, r.code as region_code 
       FROM parcel_partner_hubs h
       LEFT JOIN ghana_regions r ON h.region_id = r.id
       WHERE h.id = $1`,
      [hubId]
    );
    return rows[0] || null;
  }

  async getHubByRegionName(regionName) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT h.*, r.name as region_name, r.code as region_code 
       FROM parcel_partner_hubs h
       LEFT JOIN ghana_regions r ON h.region_id = r.id
       WHERE LOWER(TRIM(r.name)) = LOWER(TRIM($1)) AND h.is_active = TRUE
       LIMIT 1`,
      [regionName]
    );
    return rows[0] || null;
  }

  async getTransitConfig(originRegion, destRegion) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT * FROM parcel_transit_config 
       WHERE LOWER(TRIM(origin_region)) = LOWER(TRIM($1)) 
         AND LOWER(TRIM(dest_region)) = LOWER(TRIM($2)) 
         AND is_active = TRUE
       LIMIT 1`,
      [originRegion, destRegion]
    );
    return rows[0] || null;
  }

  async createStatusLog(orderId, status, hubId, updatedBy, notes = null, photoUrl = null) {
    const db = getPool();
    const { rows } = await db.query(
      `INSERT INTO parcel_status_log (order_id, status, hub_id, updated_by, notes, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orderId, status, hubId, updatedBy, notes, photoUrl]
    );
    return rows[0];
  }

  async getStatusHistory(orderId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT l.*, h.hub_name, u.email as updated_by_email, up.full_name as updated_by_name
       FROM parcel_status_log l
       LEFT JOIN parcel_partner_hubs h ON l.hub_id = h.id
       LEFT JOIN users u ON l.updated_by = u.id
       LEFT JOIN user_profiles up ON l.updated_by = up.user_id
       WHERE l.order_id = $1
       ORDER BY l.created_at DESC`,
      [orderId]
    );
    return rows;
  }
}

module.exports = ParcelPartnerRepository;
