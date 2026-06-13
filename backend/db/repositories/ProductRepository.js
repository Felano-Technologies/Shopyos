// db/repositories/ProductRepository.js
// Data access layer for products table

const BaseRepository = require('./BaseRepository');

class ProductRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'products');
  }

  /**
   * Get product inventory
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async getInventory(productId) {
    const { data, error } = await this.db
      .from('inventory')
      .select('quantity, reserved_quantity, allow_backorder, track_inventory')
      .eq('product_id', productId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      stock_quantity: data.quantity,
      reserved_quantity: data.reserved_quantity,
      allow_backorder: data.allow_backorder,
      track_inventory: data.track_inventory
    };
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
      gender,
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'created_at',
      ascending = false,
      limit = 20,
      offset = 0,
      color,
      size,
      material,
      style,
      brand
    } = params;

    const verifiedStoreIds = await this._getVerifiedStoreIds(minRating);
    const storeFilter = verifiedStoreIds.length > 0 ? verifiedStoreIds : ['00000000-0000-0000-0000-000000000000'];
    const filterOpts = { query, category, gender, minPrice, maxPrice, material, style, brand };

    if (color) {
      const colorIds = await this._getVariantOptionProductIds('color', color);
      if (!colorIds.length) return { data: [], count: 0 };
      filterOpts.colorIds = colorIds;
    }
    if (size) {
      const sizeIds = await this._getVariantOptionProductIds('size', size);
      if (!sizeIds.length) return { data: [], count: 0 };
      filterOpts.sizeIds = sizeIds;
    }

    let dbQuery = this._applySearchFilters(
      this.db.from(this.tableName)
        .select('*, stores:store_id (id, store_name, slug), product_images (image_url, is_primary)')
        .eq('is_active', true).eq('is_in_stock', true).is('deleted_at', null).in('store_id', storeFilter),
      filterOpts
    );
    dbQuery = dbQuery.order('is_promoted', { ascending: false }).order(sortBy, { ascending }).range(offset, offset + limit - 1);

    const countQuery = this._applySearchFilters(
      this.db.from(this.tableName)
        .select('id, stores:store_id(store_name)', { count: 'exact', head: true })
        .eq('is_active', true).eq('is_in_stock', true).is('deleted_at', null).in('store_id', storeFilter),
      filterOpts
    );

    const [{ data, error }, { count, error: countError }] = await Promise.all([dbQuery, countQuery]);

    if (error) throw error;
    if (countError) throw countError;

    return { data: data || [], count: count || 0 };
  }

  async _getVerifiedStoreIds(minRating) {
    const { data: verifiedStores } = await this.db
      .from('stores').select('id').eq('is_verified', true).eq('is_active', true);
    let verifiedStoreIds = (verifiedStores || []).map(s => s.id);

    if (minRating != null) {
      const { data: ratedStores, error: ratedStoresError } = await this.db
        .from('stores').select('id').eq('is_verified', true).eq('is_active', true).gte('average_rating', minRating);
      if (ratedStoresError) throw ratedStoresError;
      const ratedStoreIds = new Set((ratedStores || []).map(s => s.id));
      verifiedStoreIds = verifiedStoreIds.filter(id => ratedStoreIds.has(id));
    }

    return verifiedStoreIds;
  }

  _applySearchFilters(q, { query, category, gender, minPrice, maxPrice, material, style, brand, colorIds, sizeIds }) {
    if (query) {
      const searchTerms = query.trim().split(/\s+/).filter(Boolean);
      for (const term of searchTerms) {
        const pattern = `%${term}%`;
        q = q.or(`title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},stores.store_name.ilike.${pattern}`);
      }
    }
    if (category) q = q.ilike('category', String(category).trim());
    if (gender) q = q.eq('gender', gender);
    if (minPrice != null) q = q.gte('price', minPrice);
    if (maxPrice != null) q = q.lte('price', maxPrice);
    if (material) q = q.contains('attributes', { material });
    if (style) q = q.contains('attributes', { style });
    if (brand) q = q.ilike('brand', `%${brand}%`);
    if (colorIds) q = q.in('id', colorIds);
    if (sizeIds) q = q.in('id', sizeIds);
    return q;
  }

  /**
   * Fetch product IDs that have a variant option matching the given value.
   * @param {string} optionName - e.g. 'color' or 'size'
   * @param {string} value - the option value to match
   * @returns {Promise<string[]>}
   */
  async _getVariantOptionProductIds(optionName, value) {
    const { rows } = await this.db.query(
      `SELECT DISTINCT product_id FROM product_variant_options
       WHERE option_name = $1 AND $2 = ANY(option_values)`,
      [optionName, value]
    );
    return rows.map(r => r.product_id);
  }

  /**
   * Applies a variant-option filter to an existing Supabase query builder.
   * Returns null (not the query) when no products match, signalling an early-exit.
   * @param {object} query - Supabase query builder
   * @param {string} optionName
   * @param {string} value
   * @returns {Promise<object|null>}
   */
  async _filterByVariantOption(query, optionName, value) {
    const ids = await this._getVariantOptionProductIds(optionName, value);
    if (!ids.length) return null;
    return query.in('id', ids);
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
          owner_id,
          logo_url,
          is_verified
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
