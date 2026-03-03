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

    let query = this.supabase
      .from('user_profiles')
      .select(`
        *,
        stores:stores(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq('role', role);
    }

    if (accountStatus) {
      query = query.eq('account_status', accountStatus);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User stats
   */
  async getUserStats() {
    const { data: totalUsers, error: totalError } = await this.supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });

    const { data: activeUsers, error: activeError } = await this.supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('account_status', 'active');

    const { data: sellers, error: sellersError } = await this.supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'seller');

    const { data: drivers, error: driversError } = await this.supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'driver');

    if (totalError || activeError || sellersError || driversError) {
      throw totalError || activeError || sellersError || driversError;
    }

    return {
      total: totalUsers,
      active: activeUsers,
      suspended: totalUsers - activeUsers,
      sellers: sellers,
      drivers: drivers,
      buyers: totalUsers - sellers - drivers
    };
  }

  /**
   * Update user account status
   * @param {string} userId - User ID
   * @param {string} status - New status (active, suspended, banned)
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Updated user
   */
  async updateUserStatus(userId, status, reason = null) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update({
        account_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update user role
   * @param {string} userId - User ID
   * @param {string} role - New role (buyer, seller, driver, admin)
   * @returns {Promise<Object>} Updated user
   */
  async updateUserRole(userId, role) {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .update({
        role: role,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all stores with verification status
   * @param {Object} options - { limit, offset, verificationStatus, search }
   * @returns {Promise<Array>} List of stores
   */
  async getAllStores(options = {}) {
    const { limit = 50, offset = 0, verificationStatus, search } = options;

    let query = this.supabase
      .from('stores')
      .select(`
        *,
        owner:users!owner_id(id, email, user_profiles(full_name)),
        products:products(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
    const { data: totalStores, error: totalError } = await this.supabase
      .from('stores')
      .select('id', { count: 'exact', head: true });

    const { data: verified, error: verifiedError } = await this.supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'verified');

    const { data: pending, error: pendingError } = await this.supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending');

    const { data: active, error: activeError } = await this.supabase
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

    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
      this.supabase.rpc('get_admin_order_stats'),
      this.supabase.rpc('get_admin_product_stats'),
      this.supabase.rpc('get_admin_review_stats')
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

    let query = this.supabase
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
}

module.exports = AdminRepository;
