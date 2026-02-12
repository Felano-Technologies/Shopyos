// db/repositories/ProductRepository.js
// Data access layer for products table

const BaseRepository = require('./BaseRepository');

class ProductRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'products');
  }

  /**
   * Find all products for a store
   * @param {string} storeId
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStore(storeId, options = {}) {
    const { includeInactive = false, limit = 50, offset = 0 } = options;

    const where = {
      store_id: storeId,
      deleted_at: null // Filter out soft-deleted products
    };

    if (!includeInactive) {
      where.is_active = true;
    }

    return this.findAll({
      where,
      orderBy: 'created_at',
      ascending: false,
      limit,
      offset,
      select: options.select || '*'
    });
  }

  /**
   * Search products with filters
   * @param {Object} params
   * @param {string} params.query - Search query
   * @param {string} params.category - Filter by category
   * @param {number} params.minPrice - Minimum price
   * @param {number} params.maxPrice - Maximum price
   * @param {string} params.sortBy - Sort field (price, rating, created_at)
   * @param {boolean} params.ascending - Sort order
   * @param {number} params.limit - Max results
   * @param {number} params.offset - Pagination offset
   * @returns {Promise<Array>}
   */
  async search(params) {
    const {
      query,
      category,
      minPrice,
      maxPrice,
      sortBy = 'created_at',
      ascending = false,
      limit = 20,
      offset = 0
    } = params;

    let dbQuery = this.db
      .from(this.tableName)
      .select(`
        *,
        stores:store_id (
          id,
          store_name,
          slug
        ),
        product_images!inner (
          image_url,
          is_primary
        )
      `)
      .eq('is_active', true)
      .is('deleted_at', null);

    // Full-text search
    if (query) {
      dbQuery = dbQuery.textSearch('title', query, {
        config: 'english',
        type: 'websearch'
      });
    }

    // Filter by category
    if (category) {
      dbQuery = dbQuery.eq('category', category);
    }

    // Price range filter
    if (minPrice !== undefined) {
      dbQuery = dbQuery.gte('price', minPrice);
    }
    if (maxPrice !== undefined) {
      dbQuery = dbQuery.lte('price', maxPrice);
    }

    // Boost promoted products
    dbQuery = dbQuery.order('is_promoted', { ascending: false });

    // Apply sorting
    dbQuery = dbQuery.order(sortBy, { ascending });

    // Pagination
    dbQuery = dbQuery.range(offset, offset + limit - 1);

    const { data, error } = await dbQuery;

    if (error) throw error;

    return data || [];
  }

  /**
   * Get product with all related data
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async getProductDetails(productId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        stores:store_id (
          id,
          store_name,
          slug,
          average_rating,
          total_reviews,
          owner_id
        ),
        product_images (
          id,
          image_url,
          display_order,
          is_primary
        ),
        inventory (
          quantity,
          reserved_quantity,
          track_inventory,
          allow_backorder
        )
      `)
      .eq('id', productId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Get promoted products
   * @param {number} limit - Max results
   * @returns {Promise<Array>}
   */
  async getPromoted(limit = 10) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        stores:store_id (store_name),
        product_images (image_url, is_primary)
      `)
      .eq('is_promoted', true)
      .eq('is_active', true)
      .gt('promoted_until', new Date().toISOString())
      .is('deleted_at', null)
      .order('promotion_impressions', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  }

  /**
   * Get products by category
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
   * Increment product view count
   * @param {string} productId
   * @returns {Promise<void>}
   */
  async incrementViewCount(productId) {
    const { error } = await this.db.rpc('increment_product_views', {
      product_id: productId
    });

    if (error) throw error;
  }

  /**
   * Increment total sales
   * @param {string} productId
   * @param {number} quantity
   * @returns {Promise<void>}
   */
  async incrementSales(productId, quantity = 1) {
    const { error } = await this.db.rpc('increment_product_sales', {
      product_id: productId,
      sale_qty: quantity
    });

    if (error) throw error;
  }

  /**
   * Promote product
   * @param {string} productId
   * @param {Date} promotedUntil
   * @param {number} budget
   * @returns {Promise<Object>}
   */
  async promoteProduct(productId, promotedUntil, budget) {
    return this.update(productId, {
      is_promoted: true,
      promoted_until: promotedUntil.toISOString(),
      promotion_budget: budget
    });
  }

  /**
   * Unpromote product
   * @param {string} productId
   * @returns {Promise<Object>}
   */
  async unpromoteProduct(productId) {
    return this.update(productId, {
      is_promoted: false,
      promoted_until: null
    });
  }

  /**
   * Get related products (same category, different product)
   * @param {string} productId
   * @param {string} category
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getRelatedProducts(productId, category, limit = 6) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        product_images (image_url, is_primary)
      `)
      .eq('category', category)
      .eq('is_active', true)
      .neq('id', productId)
      .is('deleted_at', null)
      .order('average_rating', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  }

  /**
   * Get low stock products for a store
   * @param {string} storeId
   * @returns {Promise<Array>}
   */
  async getLowStockProducts(storeId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        inventory!inner (
          quantity,
          low_stock_threshold
        )
      `)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .filter('inventory.quantity', 'lte', 'inventory.low_stock_threshold')
      .is('deleted_at', null);

    if (error) throw error;

    return data || [];
  }
}

module.exports = ProductRepository;
