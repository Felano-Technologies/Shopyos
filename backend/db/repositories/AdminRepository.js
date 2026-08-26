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
        up.avatar_url,
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

    return Promise.all(rows.map(async u => ({
      id: u.id,
      user_id: u.user_id,
      full_name: u.full_name,
      phone: u.phone,
      avatar_url: await resolveImageUrl(u.avatar_url),
      email: u.email || '—',
      role: u.role || 'buyer',
      account_status: u.is_active ? 'active' : 'suspended',
      created_at: u.created_at,
    })));
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
        COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'driver')::int                           AS drivers,
        COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'parcel_partner')::int                   AS parcel_partners
      FROM user_profiles up
      JOIN users u ON u.id = up.user_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = TRUE
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
    `);

    const s = rows[0] || {};
    return {
      total:           s.total           || 0,
      active:          s.active          || 0,
      suspended:       (s.total || 0) - (s.active || 0),
      buyers:          s.buyers          || 0,
      sellers:         s.sellers         || 0,
      drivers:         s.drivers         || 0,
      parcel_partners: s.parcel_partners || 0,
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

    return Promise.all(rows.map(async store => ({
      ...store,
      logo_url:              await resolveImageUrl(store.logo_url),
      banner_url:            await resolveImageUrl(store.banner_url),
      business_cert_url:     await resolveImageUrl(store.business_cert_url),
      business_license_url:  await resolveImageUrl(store.business_license_url),
      proof_of_bank_url:     await resolveImageUrl(store.proof_of_bank_url),
      owner: {
        id:        store.owner_user_id,
        email:     store.owner_email,
        full_name: store.owner_full_name,
      },
      products: [{ count: store.product_count }],
    })));
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
        COUNT(*) FILTER (WHERE is_active = TRUE)::int                          AS active
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
   * Get top-performing stores by revenue (completed/delivered orders), for the dashboard.
   */
  async getTopStores(limit = 5) {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        s.id, s.store_name, s.logo_url,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status IN ('completed', 'delivered')), 0) AS revenue
      FROM stores s
      LEFT JOIN orders o ON o.store_id = s.id
      GROUP BY s.id, s.store_name, s.logo_url
      ORDER BY revenue DESC, order_count DESC
      LIMIT $1
    `, [limit]);

    return Promise.all(rows.map(async s => ({
      id:          s.id,
      store_name:  s.store_name,
      logo_url:    await resolveImageUrl(s.logo_url),
      order_count: s.order_count || 0,
      revenue:     Number.parseFloat(s.revenue) || 0,
    })));
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
   * Get order statistics (platform-wide counts)
   */
  async getOrderStats() {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int                                                     AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int                  AS pending,
        COUNT(*) FILTER (WHERE status = 'in_transit')::int               AS in_transit,
        COUNT(*) FILTER (WHERE status IN ('delivered', 'completed'))::int AS delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int                AS cancelled
      FROM orders
    `);
    const s = rows[0] || {};
    return {
      total:      s.total      || 0,
      pending:    s.pending    || 0,
      in_transit: s.in_transit || 0,
      delivered:  s.delivered  || 0,
      cancelled:  s.cancelled  || 0,
    };
  }

  /**
   * Get all deliveries (admin view) — the logistics/dispatch record, distinct
   * from the order itself. Joins driver assignment, pickup/dropoff addresses,
   * and timing so admins can monitor active dispatch, not just order status.
   */
  async getAllDeliveries(options = {}) {
    const { limit = 50, offset = 0, status } = options;
    const db = getPool();
    const params = [];

    let sql = `
      SELECT
        d.id, d.status, d.pickup_address, d.delivery_address,
        d.distance_km, d.delivery_fee, d.driver_earnings,
        d.assigned_at, d.picked_up_at, d.delivered_at, d.created_at,
        o.id           AS order_id,
        o.order_number,
        o.total_amount,
        s.id           AS store_id,
        s.store_name,
        bup.full_name  AS buyer_full_name,
        bu.email       AS buyer_email,
        d.driver_id,
        dup.full_name  AS driver_full_name,
        du.email       AS driver_email,
        ddp.license_plate AS driver_plate
      FROM deliveries d
      LEFT JOIN orders          o   ON o.id = d.order_id
      LEFT JOIN stores          s   ON s.id = o.store_id
      LEFT JOIN users           bu  ON bu.id = o.buyer_id
      LEFT JOIN user_profiles   bup ON bup.user_id = o.buyer_id
      LEFT JOIN users           du  ON du.id = d.driver_id
      LEFT JOIN user_profiles   dup ON dup.user_id = d.driver_id
      LEFT JOIN driver_profiles ddp ON ddp.user_id = d.driver_id
      WHERE 1=1
    `;

    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length > 1) {
        params.push(statuses);
        sql += ` AND d.status = ANY($${params.length}::delivery_status[])`;
      } else {
        params.push(statuses[0]);
        sql += ` AND d.status = $${params.length}`;
      }
    }

    sql += ` ORDER BY d.created_at DESC`;
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const { rows } = await db.query(sql, params);

    return rows.map(d => ({
      id:               d.id,
      status:           d.status,
      pickup_address:   d.pickup_address,
      delivery_address: d.delivery_address,
      distance_km:      d.distance_km,
      delivery_fee:     d.delivery_fee,
      driver_earnings:  d.driver_earnings,
      assigned_at:      d.assigned_at,
      picked_up_at:     d.picked_up_at,
      delivered_at:     d.delivered_at,
      created_at:       d.created_at,
      order: { id: d.order_id, order_number: d.order_number, total_amount: d.total_amount },
      store: { id: d.store_id, store_name: d.store_name },
      buyer_name: d.buyer_full_name || d.buyer_email || 'Unknown',
      driver: d.driver_id
        ? { id: d.driver_id, full_name: d.driver_full_name || d.driver_email || 'Unknown', plate: d.driver_plate }
        : null,
    }));
  }

  /**
   * Get delivery statistics (platform-wide dispatch counts)
   */
  async getDeliveryStats() {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int                                                              AS total,
        COUNT(*) FILTER (WHERE status = 'unassigned')::int                        AS unassigned,
        COUNT(*) FILTER (WHERE status NOT IN ('unassigned', 'delivered', 'cancelled'))::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'delivered')::int                         AS delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int                         AS cancelled
      FROM deliveries
    `);
    const s = rows[0] || {};
    return {
      total:       s.total       || 0,
      unassigned:  s.unassigned  || 0,
      in_progress: s.in_progress || 0,
      delivered:   s.delivered   || 0,
      cancelled:   s.cancelled   || 0,
    };
  }

  /**
   * Get daily revenue trend (last N days) for the dashboard bar chart.
   * Uses completed payments, same source as the platform-wide totalRevenue figure.
   */
  async getRevenueTrend(days = 14) {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        gs.day::date AS date,
        COALESCE(p.revenue, 0) AS revenue
      FROM generate_series(
        (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')::date,
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS gs(day)
      LEFT JOIN (
        SELECT DATE(COALESCE(paid_at, created_at)) AS day, SUM(amount) AS revenue
        FROM payments
        WHERE status = 'completed'
          AND COALESCE(paid_at, created_at) >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
        GROUP BY DATE(COALESCE(paid_at, created_at))
      ) p ON p.day = gs.day::date
      ORDER BY gs.day
    `, [days]);

    return rows.map(r => ({
      date: r.date,
      revenue: Number.parseFloat(r.revenue) || 0,
    }));
  }

  /**
   * Get daily new-signup counts (last N days), split by role, for the dashboard growth chart.
   * A user with multiple active roles is counted once per role, matching getUserStats().
   */
  async getUserGrowthTrend(days = 14) {
    const db = getPool();
    const { rows } = await db.query(`
      SELECT
        gs.day::date AS date,
        COALESCE(SUM(CASE WHEN r.name IN ('buyer', 'customer') THEN 1 ELSE 0 END), 0)::int AS buyers,
        COALESCE(SUM(CASE WHEN r.name = 'seller' THEN 1 ELSE 0 END), 0)::int               AS sellers,
        COALESCE(SUM(CASE WHEN r.name = 'driver' THEN 1 ELSE 0 END), 0)::int               AS drivers
      FROM generate_series(
        (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day')::date,
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS gs(day)
      LEFT JOIN users u
        ON DATE(u.created_at) = gs.day::date
       AND u.deleted_at IS NULL
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = TRUE
      LEFT JOIN roles r       ON r.id = ur.role_id
      GROUP BY gs.day
      ORDER BY gs.day
    `, [days]);

    return rows.map(r => ({
      date:    r.date,
      buyers:  r.buyers  || 0,
      sellers: r.sellers || 0,
      drivers: r.drivers || 0,
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
