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
        owner:user_profiles!stores_owner_id_fkey(id, full_name, email),
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
    return data;
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
    // Get order statistics
    const { data: orders } = await this.supabase
      .from('orders')
      .select('total_amount, status');

    const orderStats = {
      total: orders?.length || 0,
      completed: orders?.filter(o => o.status === 'delivered').length || 0,
      pending: orders?.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled').length || 0,
      totalRevenue: orders?.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || 0
    };

    // Get product statistics
    const { data: products } = await this.supabase
      .from('products')
      .select('status');

    const productStats = {
      total: products?.length || 0,
      active: products?.filter(p => p.status === 'active').length || 0,
      outOfStock: products?.filter(p => p.status === 'out_of_stock').length || 0
    };

    // Get review statistics
    const { data: reviews } = await this.supabase
      .from('product_reviews')
      .select('rating');

    const reviewStats = {
      total: reviews?.length || 0,
      averageRating: reviews?.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 0
    };

    return {
      orders: orderStats,
      products: productStats,
      reviews: reviewStats
    };
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
        user:user_profiles(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

module.exports = AdminRepository;
