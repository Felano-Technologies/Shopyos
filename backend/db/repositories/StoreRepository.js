// db/repositories/StoreRepository.js

const BaseRepository = require('./BaseRepository');

class StoreRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'stores');
  }

  /**
   * Find store by slug
   * @param {string} slug
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug) {
    return this.findOne({ slug, is_active: true });
  }

  /**
   * Find all stores owned by user
   * @param {string} ownerId
   * @returns {Promise<Array>}
   */
  async findByOwnerId(ownerId) {
    return this.findAll({
      where: { owner_id: ownerId, is_active: true },
      orderBy: 'created_at',
      ascending: false
    });
  }

  /**
   * Search stores by name or category
   * @param {Object} params
   * @param {string} params.query - Search query
   * @param {string} params.category - Filter by category
   * @param {number} params.limit - Max results
   * @param {number} params.offset - Pagination offset
   * @returns {Promise<Array>}
   */
  async search(params) {
    const { query, category, limit = 20, offset = 0 } = params;

    let dbQuery = this.db
      .from(this.tableName)
      .select('*')
      .eq('is_active', true);

    // Full-text search on name and description
    if (query) {
      dbQuery = dbQuery.textSearch('store_name', query, {
        config: 'english',
        type: 'websearch'
      });
    }

    // Filter by category
    if (category) {
      dbQuery = dbQuery.eq('category', category);
    }

    // Order by rating and total sales
    dbQuery = dbQuery
      .order('average_rating', { ascending: false })
      .order('total_sales', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await dbQuery;

    if (error) throw error;

    return data || [];
  }

  /**
   * Get featured stores
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async getFeatured(limit = 10) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('is_featured', true)
      .eq('is_active', true)
      .gt('featured_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  }

  /**
   * Get store with products count
   * @param {string} storeId
   * @returns {Promise<Object|null>}
   */
  async getStoreWithStats(storeId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        products:products(count)
      `)
      .eq('id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get store details with owner information
   * @param {string} storeId
   * @returns {Promise<Object|null>}
   */
  async getStoreDetails(storeId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        owner:owner_id (
          id,
          email,
          user_profiles (full_name, phone)
        )
      `)
      .eq('id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Update store verification status
   * @param {string} storeId
   * @param {boolean} isVerified
   * @returns {Promise<Object>}
   */
  async updateVerificationStatus(storeId, isVerified) {
    return this.update(storeId, { is_verified: isVerified });
  }

  /**
   * Feature store
   * @param {string} storeId
   * @param {Date} featuredUntil
   * @returns {Promise<Object>}
   */
  async featureStore(storeId, featuredUntil) {
    return this.update(storeId, {
      is_featured: true,
      featured_until: featuredUntil.toISOString()
    });
  }

  /**
   * Unfeature store
   * @param {string} storeId
   * @returns {Promise<Object>}
   */
  async unfeatureStore(storeId) {
    return this.update(storeId, {
      is_featured: false,
      featured_until: null
    });
  }

  /**
   * Increment total sales
   * @param {string} storeId
   * @returns {Promise<Object>}
   */
  async incrementSales(storeId) {
    const { data, error } = await this.db.rpc('increment_store_sales', {
      store_id: storeId
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get stores by category
   * @param {string} category
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Array>}
   */
  async getByCategory(category, limit = 20, offset = 0) {
    return this.findAll({
      where: { category, is_active: true },
      orderBy: 'average_rating',
      ascending: false,
      limit,
      offset
    });
  }

  /**
   * Get nearby stores (within radius)
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radiusKm - Radius in kilometers
   * @returns {Promise<Array>}
   */
  async getNearby(latitude, longitude, radiusKm = 10) {
    const { data, error } = await this.db.rpc('get_nearby_stores', {
      lat: latitude,
      lng: longitude,
      radius_km: radiusKm
    });

    if (error) throw error;
    return data || [];
  }
}

module.exports = StoreRepository;
