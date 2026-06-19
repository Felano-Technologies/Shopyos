// db/repositories/AdminRepository.js
// Repository for admin operations - uses raw SQL for joined queries
// (the PostgREST-style query builder strips complex selects to bare *)

const BaseRepository = require('./BaseRepository');
const { resolveImageUrl } = require('../../config/storage');
const { getPool } = require('../../config/postgres');

class AdminRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'users');
  }

  /**
   * Get all users with pagination and filters
   * @param {Object} options - { limit, offset, role, accountStatus, search }
   * @returns {Promise<Array>} List of users
   */
  async getAllUsers(options = {}) {
    const { limit = 50, offset = 0, role, accountStatus, search } = options;
    const db = getPool();
    const params = [];

    let sql = `
      SELECT
        up.id,
        up.user_id,
        up.full_name,
        up.phone,
        up.created_at,
        u.email,
        u.is_active,
        r.name AS role
      FROM user_profiles up
      JOIN users u ON u.id = up.user_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = TRUE
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
    `;

    if (role) {
      params.push(role);
      sql += ` AND r.name = $${params.length}`;
    }

    if (accountStatus) {
      params.push(accountStatus === 'active');
      sql += ` AND u.is_active = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (up.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR up.phone ILIKE $${params.length})`;
    }

    sql += ` ORDER BY up.created_at DESC`;

    params.push(limit);
    sql += ` LIMIT $${params.length}`;

    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);

    return rows.map(u => ({
      id: u.id,
      user_id: u.user_id,
      full_name: u.full_name,
      phone: u.phone,
      email: u.email || '—',
      role: u.role || 'buyer',
      account_status: u.is_active ? 'active' : 'suspended',
      created_at: u.created_at,
    }));
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User stats
   */
  async getUserStats() {
    const db = getPool();

    const { rows } = await db.query(`
      SELECT
        COUNT(DISTINCT up.id)::int                                                                  AS total,
        COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = TRUE)::int                                AS active,
        COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name IN ('buyer', 'customer'))::int             AS buyers,
        COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'seller')::int                           AS sellers,
        COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'driver')::int                           AS drivers
      FROM user_profiles up
      JOIN users u ON u.id = up.user_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = TRUE
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
    `);

    const s = rows[0] || {};
    return {
      total:     s.total     || 0,
      active:    s.active    || 0,
      suspended: (s.total || 0) - (s.active || 0),
      buyers:    s.buyers    || 0,
      sellers:   s.sellers   || 0,
      drivers:   s.drivers   || 0,
    };
  }

  /**
   * Update user account status
   */
  async updateUserStatus(profileId, status, _reason = null) {
    const db = getPool();

    // 1. Resolve user_id from profile id
    const { rows: profileRows } = await db.query(
      'SELECT user_id FROM user_profiles WHERE id = $1',
      [profileId]
    );
    if (!profileRows.length) throw new Error('User profile not found');

    const userId = profileRows[0].user_id;

    // 2. Update users table
    const { rows } = await db.query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status === 'active', userId]
    );
    return rows[0] || null;
  }

  /**
   * Update user role by profile primary key ID
   */
  async updateUserRole(profileId, roleName) {
    const db = getPool();
    const { rows: profileRows } = await db.query(
      'SELECT user_id FROM user_profiles WHERE id = $1',
      [profileId]
    );
    if (!profileRows.length) throw new Error('User profile not found');
    return this.setUserRoleByUserId(profileRows[0].user_id, roleName);
  }

  /**
   * Set user role by user UUID
   */
  async setUserRoleByUserId(userId, roleName) {
    const db = getPool();

    const { rows: roleRows } = await db.query(
      'SELECT id FROM roles WHERE name = $1',
      [roleName]
    );
    if (!roleRows.length) throw new Error(`Role ${roleName} not found`);
    const roleId = roleRows[0].id;

    // Clear existing roles then assign new
    await db.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

    const { rows } = await db.query(
      `INSERT INTO user_roles (user_id, role_id, is_active) VALUES ($1, $2, TRUE) RETURNING *`,
      [userId, roleId]
    );
    return rows[0] || null;
  }

  /**
   * Get all stores with verification status
   */
  async getAllStores(options = {}) {
    const { limit = 50, offset = 0, verificationStatus, search, id } = options;
    const db = getPool();
    const params = [];

    let sql = `
      SELECT
        s.*,
        u.id          AS owner_user_id,
        u.email       AS owner_email,
        up.full_name  AS owner_full_name,
        COUNT(p.id)::int AS product_count
      FROM stores s
      LEFT JOIN users u         ON u.id = s.owner_id
      LEFT JOIN user_profiles up ON up.user_id = s.owner_id
      LEFT JOIN products p       ON p.store_id = s.id AND p.deleted_at IS NULL
      WHERE 1=1
    `;

    if (id) {
      params.push(id);
      sql += ` AND s.id = $${params.length}`;
    }

    if (verificationStatus) {
      params.push(verificationStatus);
      sql += ` AND s.verification_status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (s.store_name ILIKE $${params.length} OR s.business_name ILIKE $${params.length})`;
    }

    sql += ` GROUP BY s.id, u.id, u.email, up.full_name ORDER BY s.created_at DESC`;

    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);

    return rows.map(store => ({
      ...store,
      owner: {
        id:        store.owner_user_id,
        email:     store.owner_email,
        full_name: store.owner_full_name,
      },
      products: [{ count: store.product_count }],
    }));
  }

  /**
   * Get store statistics
   */
  async getStoreStats() {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int                                                            AS total,
        COUNT(*) FILTER (WHERE verification_status = 'verified')::int           AS verified,
        COUNT(*) FILTER (WHERE verification_status = 'pending')::int            AS pending,
        COUNT(*) FILTER (WHERE status = 'active')::int                          AS active
      FROM stores
    `);
    const s = rows[0] || {};
    return {
      total:    s.total    || 0,
      verified: s.verified || 0,
      pending:  s.pending  || 0,
      rejected: (s.total || 0) - (s.verified || 0) - (s.pending || 0),
      active:   s.active   || 0,
      inactive: (s.total || 0) - (s.active || 0),
    };
  }

  /**
   * Update store verification status
   */
  async updateStoreVerification(storeId, status, reason = null) {
    const db = getPool();
    const params = [status, storeId];
    let sql = `UPDATE stores SET verification_status = $1, updated_at = NOW()`;
    if (status === 'verified') sql += `, verified_at = NOW()`;
    if (reason) { params.push(reason); sql += `, rejection_reason = $${params.length}`; }
    sql += ` WHERE id = $2 RETURNING *`;
    const { rows } = await db.query(sql, params);
    if (!rows.length) throw new Error('Store not found');
    return rows[0];
  }

  /**
   * Update store status
   */
  async updateStoreStatus(storeId, status) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE stores SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, storeId]
    );
    if (!rows.length) throw new Error('Store not found');
    return rows[0];
  }

  /**
   * Get platform analytics via RPCs
   */
  async getPlatformAnalytics() {
    const [
      { data: orderStats,   error: orderError   },
      { data: productStats, error: productError },
      { data: reviewStats,  error: reviewError  },
    ] = await Promise.all([
      this.db.rpc('get_admin_order_stats'),
      this.db.rpc('get_admin_product_stats'),
      this.db.rpc('get_admin_review_stats'),
    ]);

    if (orderError)   throw orderError;
    if (productError) throw productError;
    if (reviewError)  throw reviewError;

    return {
      orders: {
        total:       orderStats?.total_orders     || 0,
        completed:   orderStats?.completed_orders || 0,
        pending:     orderStats?.pending_orders   || 0,
        cancelled:   orderStats?.cancelled_orders || 0,
        totalRevenue: orderStats?.total_revenue   || 0,
      },
      products: {
        total:      productStats?.total_products       || 0,
        active:     productStats?.active_products      || 0,
        outOfStock: productStats?.out_of_stock_products || 0,
      },
      reviews: {
        total:         reviewStats?.total_reviews  || 0,
        averageRating: reviewStats?.average_rating || 0,
      },
    };
  }

  /**
   * Get all orders (admin view)
   */
  async getAllOrders(options = {}) {
    const { limit = 50, offset = 0, status, search } = options;
    const db = getPool();
    const params = [];

    let sql = `
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.total_amount,
        o.created_at,
        s.id          AS store_id,
        s.store_name,
        u.id          AS buyer_user_id,
        u.email       AS buyer_email,
        up.full_name  AS buyer_full_name,
        COUNT(oi.id)::int AS items_count
      FROM orders o
      LEFT JOIN stores s         ON s.id = o.store_id
      LEFT JOIN users u          ON u.id = o.buyer_id
      LEFT JOIN user_profiles up ON up.user_id = o.buyer_id
      LEFT JOIN order_items oi   ON oi.order_id = o.id
      WHERE 1=1
    `;

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND o.order_number ILIKE $${params.length}`;
    }

    sql += ` GROUP BY o.id, s.id, s.store_name, u.id, u.email, up.full_name ORDER BY o.created_at DESC`;

    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);

    return rows.map(o => ({
      id:           o.id,
      order_number: o.order_number,
      status:       o.status,
      total_amount: o.total_amount,
      created_at:   o.created_at,
      store: { id: o.store_id, store_name: o.store_name },
      buyer: {
        id:    o.buyer_user_id,
        email: o.buyer_email,
        user_profiles: { full_name: o.buyer_full_name },
      },
      buyer_name:  o.buyer_full_name || o.buyer_email || 'Unknown',
      items_count: o.items_count || 0,
    }));
  }

  /**
   * Get revenue transactions (completed payments)
   */
  async getRevenueTransactions(options = {}) {
    const { limit = 50, offset = 0 } = options;
    const db = getPool();

    const { rows } = await db.query(
      `SELECT
         p.id, p.amount, p.status, p.created_at,
         o.id AS order_id, o.order_number,
         s.store_name
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       LEFT JOIN stores s ON s.id = o.store_id
       WHERE p.status = 'completed'
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return rows.map(t => ({
      id:         t.id,
      amount:     t.amount,
      status:     t.status,
      created_at: t.created_at,
      order: {
        id:           t.order_id,
        order_number: t.order_number,
        store:        { store_name: t.store_name },
      },
    }));
  }

  /**
   * Get recent activity from audit_logs
   */
  async getRecentActivity(limit = 20) {
    const db = getPool();

    const { rows } = await db.query(
      `SELECT
         al.*,
         u.id    AS user_id_val,
         u.email AS user_email,
         up.full_name AS user_full_name
       FROM audit_logs al
       LEFT JOIN users u          ON u.id = al.user_id
       LEFT JOIN user_profiles up ON up.user_id = al.user_id
       ORDER BY al.timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return rows.map(log => ({
      ...log,
      user: {
        id:        log.user_id_val,
        email:     log.user_email,
        full_name: log.user_full_name,
      },
    }));
  }

  /**
   * Get driver verifications list
   */
  async getDriverVerifications() {
    const db = getPool();

    const { rows } = await db.query(`
      SELECT
        dp.*,
        u.id    AS user_id_val,
        u.email,
        up.full_name,
        up.phone,
        up.avatar_url
      FROM driver_profiles dp
      LEFT JOIN users u          ON u.id = dp.user_id
      LEFT JOIN user_profiles up ON up.user_id = dp.user_id
      ORDER BY dp.created_at DESC
    `);

    return Promise.all(rows.map(async d => {
      const driverVerificationStatus = d.rejection_reason ? 'rejected' : 'pending';
      return {
        ...d,
        full_name:          d.full_name   || 'Unknown',
        email:              d.email       || 'Unknown',
        phone:              d.phone       || 'Unknown',
        avatar_url:         await resolveImageUrl(d.avatar_url),
        status:             d.is_verified ? 'verified' : driverVerificationStatus,
        verification_status: d.is_verified ? 'verified' : driverVerificationStatus,
        license_image:      await resolveImageUrl(d.license_image_url),
        insurance_image:    await resolveImageUrl(d.insurance_doc_url),
        id_image:           await resolveImageUrl(d.national_id_url),
        vehicle_reg_image:  await resolveImageUrl(d.vehicle_reg_url),
        roadworthy_image:   await resolveImageUrl(d.roadworthy_url),
        vehicle_plate:      d.license_plate,
      };
    }));
  }


  /**
   * Get single driver verification details
   */
  async getDriverVerificationDetails(id) {
    const db = getPool();

    const { rows } = await db.query(`
      SELECT
        dp.*,
        u.id    AS user_id_val,
        u.email,
        up.full_name,
        up.phone,
        up.avatar_url,
        up.address_line1,
        up.city,
        up.country
      FROM driver_profiles dp
      LEFT JOIN users u          ON u.id = dp.user_id
      LEFT JOIN user_profiles up ON up.user_id = dp.user_id
      WHERE dp.id = $1
    `, [id]);

    if (!rows.length) return null;
    const d = rows[0];

    const driverVerificationStatus = d.rejection_reason ? 'rejected' : 'pending';
    return {
      ...d,
      user_profiles: {
        full_name:    d.full_name,
        phone:        d.phone,
        avatar_url:   await resolveImageUrl(d.avatar_url),
        address_line1: d.address_line1,
        city:         d.city,
        country:      d.country,
      },
      email:              d.email,
      status:             d.is_verified ? 'verified' : driverVerificationStatus,
      verification_status: d.is_verified ? 'verified' : driverVerificationStatus,
      license_image:      await resolveImageUrl(d.license_image_url),
      insurance_image:    await resolveImageUrl(d.insurance_doc_url),
      id_image:           await resolveImageUrl(d.national_id_url),
      vehicle_reg_image:  await resolveImageUrl(d.vehicle_reg_url),
      roadworthy_image:   await resolveImageUrl(d.roadworthy_url),
      vehicle_plate:      d.license_plate,
    };
  }

  /**
   * Approve driver verification
   */
  async approveDriver(id) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE driver_profiles SET is_verified = TRUE, rejection_reason = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!rows.length) throw new Error('Driver not found');
    await this.setUserRoleByUserId(rows[0].user_id, 'driver');
    return rows[0];
  }

  /**
   * Reject driver verification
   */
  async rejectDriver(id, reason) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE driver_profiles SET is_verified = FALSE, rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reason, id]
    );
    if (!rows.length) throw new Error('Driver not found');
    return rows[0];
  }
}

module.exports = AdminRepository;
