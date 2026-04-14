// db/repositories/AdminRepository.js
// Repository for admin operations - user management, store verification, analytics

const BaseRepository = require('./BaseRepository');

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

    let query = this.db
      .from('user_profiles')
      .select(`
        id,
        user_id,
        full_name,
        phone,
        created_at,
        users!user_id!inner(
          email,
          is_active,
          user_roles(
            roles(name)
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      // PostgREST filtering on joined tables
      query = query.eq('users.user_roles.roles.name', role);
    }

    if (accountStatus) {
      const isActive = accountStatus === 'active';
      query = query.eq('users.is_active', isActive);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Normalize data for frontend
    return (data || []).map(u => {
      const roles = u.users?.user_roles || [];
      const roleName = roles.length > 0 ? roles[0].roles?.name : 'buyer';
      
      return {
        id: u.id,
        user_id: u.user_id,
        full_name: u.full_name,
        phone: u.phone,
        email: u.users?.email || '—',
        role: roleName,
        account_status: u.users?.is_active ? 'active' : 'suspended',
        created_at: u.created_at
      };
    });
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User stats
   */
  async getUserStats() {
    // We use RPC or multiple queries. For simplicity and accuracy with joins:
    const { count: total, error: totalErr } = await this.db
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });

    const { count: active, error: activeErr } = await this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: sellers, error: sellerErr } = await this.db
      .from('user_roles')
      .select('id, roles!inner(name)', { count: 'exact', head: true })
      .eq('roles.name', 'seller');

    const { count: drivers, error: driverErr } = await this.db
      .from('user_roles')
      .select('id, roles!inner(name)', { count: 'exact', head: true })
      .eq('roles.name', 'driver');

    if (totalErr || activeErr || sellerErr || driverErr) {
      throw totalErr || activeErr || sellerErr || driverErr;
    }

    return {
      total: total || 0,
      active: active || 0,
      suspended: (total || 0) - (active || 0),
      sellers: sellers || 0,
      drivers: drivers || 0,
      buyers: (total || 0) - (sellers || 0) - (drivers || 0)
    };
  }

  /**
   * Update user account status
   * @param {string} userId - User ID
   * @param {string} status - New status (active, suspended, banned)
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Updated user
   */
  async updateUserStatus(profileId, status, reason = null) {
    // 1. Get the actual user_id from profileId
    const { data: profile } = await this.db
      .from('user_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();

    if (!profile) throw new Error('User profile not found');

    // 2. Update users table (is_active)
    const { data, error } = await this.db
      .from('users')
      .update({
        is_active: status === 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.user_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user role by user UUID
   * @param {string} userId - User UUID
   * @param {string} roleName - New role (buyer, seller, driver, admin)
   * @returns {Promise<Object>} Updated user_role record
   */
  async setUserRoleByUserId(userId, roleName) {
    // 1. Get role ID
    const { data: roleData } = await this.db
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (!roleData) throw new Error(`Role ${roleName} not found`);

    // 2. Clear existing roles (driver/seller/buyer are usually mutually exclusive for the primary role)
    await this.db.from('user_roles').delete().eq('user_id', userId);

    // 3. Set new role
    const { data, error } = await this.db
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleData.id,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user role by profile primary key ID
   * @param {string} profileId - User profile ID
   * @param {string} roleName - New role name
   */
  async updateUserRole(profileId, roleName) {
    // 1. Get user_id from profileId
    const { data: profile } = await this.db
      .from('user_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();

    if (!profile) throw new Error('User profile not found');
    
    return this.setUserRoleByUserId(profile.user_id, roleName);
  }

  /**
   * Get all stores with verification status
   * @param {Object} options - { limit, offset, verificationStatus, search }
   * @returns {Promise<Array>} List of stores
   */
  async getAllStores(options = {}) {
    const { limit = 50, offset = 0, verificationStatus, search, id } = options;

    let query = this.db
      .from('stores')
      .select(`
        *,
        owner:users!owner_id(id, email, user_profiles(full_name)),
        products:products(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (id) {
      query = query.eq('id', id);
    }

    if (verificationStatus) {
      query = query.eq('verification_status', verificationStatus);
    }

    if (search) {
      query = query.or(`store_name.ilike.%${search}%,business_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten nested user_profiles into owner.full_name
    return (data || []).map(store => ({
      ...store,
      owner: store.owner ? {
        id: store.owner.id,
        email: store.owner.email,
        full_name: Array.isArray(store.owner.user_profiles)
          ? store.owner.user_profiles[0]?.full_name || null
          : store.owner.user_profiles?.full_name || null,
      } : null,
    }));
  }

  /**
   * Get store statistics
   * @returns {Promise<Object>} Store stats
   */
  async getStoreStats() {
    const { data: totalStores, error: totalError } = await this.db
      .from('stores')
      .select('id', { count: 'exact', head: true });

    const { data: verified, error: verifiedError } = await this.db
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'verified');

    const { data: pending, error: pendingError } = await this.db
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending');

    const { data: active, error: activeError } = await this.db
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (totalError || verifiedError || pendingError || activeError) {
      throw totalError || verifiedError || pendingError || activeError;
    }

    return {
      total: totalStores,
      verified: verified,
      pending: pending,
      rejected: totalStores - verified - pending,
      active: active,
      inactive: totalStores - active
    };
  }

  /**
   * Update store verification status
   * @param {string} storeId - Store ID
   * @param {string} status - New status (pending, verified, rejected)
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Updated store
   */
  async updateStoreVerification(storeId, status, reason = null) {
    const updateData = {
      verification_status: status,
      updated_at: new Date().toISOString()
    };

    if (status === 'verified') {
      updateData.verified_at = new Date().toISOString();
    }

    if (reason) {
      updateData.rejection_reason = reason;
    }

    const { data, error } = await this.db
      .from('stores')
      .update(updateData)
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update store status
   * @param {string} storeId - Store ID
   * @param {string} status - New status (active, inactive, suspended)
   * @returns {Promise<Object>} Updated store
   */
  async updateStoreStatus(storeId, status) {
    const { data, error } = await this.db
      .from('stores')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get platform analytics
   * @returns {Promise<Object>} Platform statistics
   */
  async getPlatformAnalytics() {
    // Get stats from optimized RPC endpoints concurrently
    const [
      { data: orderStats, error: orderError },
      { data: productStats, error: productError },
      { data: reviewStats, error: reviewError }
    ] = await Promise.all([
      this.db.rpc('get_admin_order_stats'),
      this.db.rpc('get_admin_product_stats'),
      this.db.rpc('get_admin_review_stats')
    ]);

    if (orderError) throw orderError;
    if (productError) throw productError;
    if (reviewError) throw reviewError;

    return {
      orders: {
        total: orderStats?.total_orders || 0,
        completed: orderStats?.completed_orders || 0,
        pending: orderStats?.pending_orders || 0,
        cancelled: orderStats?.cancelled_orders || 0,
        totalRevenue: orderStats?.total_revenue || 0
      },
      products: {
        total: productStats?.total_products || 0,
        active: productStats?.active_products || 0,
        outOfStock: productStats?.out_of_stock_products || 0
      },
      reviews: {
        total: reviewStats?.total_reviews || 0,
        averageRating: reviewStats?.average_rating || 0
      }
    };
  }

  /**
   * Get all orders (admin view)
   * @param {Object} options
   */
  async getAllOrders(options = {}) {
    const { limit = 50, offset = 0, status, search } = options;

    let query = this.db
      .from('orders')
      .select(`
        id, order_number, status, total_amount, created_at,
        store:stores(id, store_name),
        buyer:users!buyer_id(id, email, user_profiles(full_name)),
        order_items(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(o => ({
      ...o,
      buyer_name: Array.isArray(o.buyer?.user_profiles)
        ? o.buyer.user_profiles[0]?.full_name || o.buyer?.email || 'Unknown'
        : o.buyer?.user_profiles?.full_name || o.buyer?.email || 'Unknown',
      items_count: o.order_items?.[0]?.count ?? 0,
    }));
  }

  /**
   * Get revenue transactions (completed payments)
   */
  async getRevenueTransactions(options = {}) {
    const { limit = 50, offset = 0 } = options;
    const { data, error } = await this.db
      .from('payments')
      .select(`
        id, amount, status, created_at,
        order:orders(id, order_number, store:stores(store_name))
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  /**
   * Get recent activity
   * @param {number} limit - Number of activities to fetch
   * @returns {Promise<Array>} Recent activities
   */
  async getRecentActivity(limit = 20) {
    const { data, error } = await this.db
      .from('audit_logs')
      .select(`
        *,
        user:users!user_id(id, email, user_profiles(full_name))
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(log => ({
      ...log,
      user: log.user ? {
        id: log.user.id,
        email: log.user.email,
        full_name: Array.isArray(log.user.user_profiles)
          ? log.user.user_profiles[0]?.full_name || null
          : log.user.user_profiles?.full_name || null,
      } : null,
    }));
  }

  /**
   * Get driver verifications list
   */
  async getDriverVerifications() {
    const { data, error } = await this.db
      .from('driver_profiles')
      .select(`
        *,
        user:users!user_id(id, email, user_profiles(*))
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(d => {
      const up = Array.isArray(d.user?.user_profiles) ? d.user.user_profiles[0] : d.user?.user_profiles;
      return {
        ...d,
        full_name: up?.full_name || 'Unknown',
        email: d.user?.email || 'Unknown',
        phone: up?.phone || 'Unknown',
        avatar_url: up?.avatar_url,
        status: d.is_verified ? 'verified' : (d.rejection_reason ? 'rejected' : 'pending'),
        verification_status: d.is_verified ? 'verified' : (d.rejection_reason ? 'rejected' : 'pending'),
        license_image: d.license_image_url,
        insurance_image: d.insurance_doc_url,
        id_image: d.national_id_url,
        vehicle_reg_image: d.vehicle_reg_url,
        roadworthy_image: d.roadworthy_url,
        vehicle_plate: d.license_plate,
      };
    });
  }

  /**
   * Get single driver verification details
   */
  async getDriverVerificationDetails(id) {
    const { data, error } = await this.db
      .from('driver_profiles')
      .select(`
        *,
        user:users!user_id(id, email, user_profiles(*))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    const up = Array.isArray(data.user?.user_profiles) ? data.user.user_profiles[0] : data.user?.user_profiles;
    return {
      ...data,
      user_profiles: up || {},
      status: data.is_verified ? 'verified' : (data.rejection_reason ? 'rejected' : 'pending'),
      verification_status: data.is_verified ? 'verified' : (data.rejection_reason ? 'rejected' : 'pending'),
      email: data.user?.email,
      license_image: data.license_image_url,
      insurance_image: data.insurance_doc_url,
      id_image: data.national_id_url,
      vehicle_reg_image: data.vehicle_reg_url,
      roadworthy_image: data.roadworthy_url,
      vehicle_plate: data.license_plate,
    };
  }

  /**
   * Approve driver verification
   */
  async approveDriver(id) {
    const { data, error } = await this.db
      .from('driver_profiles')
      .update({ is_verified: true, rejection_reason: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    
    // Also update their user role to 'driver'
    await this.setUserRoleByUserId(data.user_id, 'driver');
    return data;
  }

  /**
   * Reject driver verification
   */
  async rejectDriver(id, reason) {
    const { data, error } = await this.db
      .from('driver_profiles')
      .update({ is_verified: false, rejection_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

module.exports = AdminRepository;
