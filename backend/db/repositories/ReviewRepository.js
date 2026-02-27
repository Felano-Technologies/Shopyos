// db/repositories/ReviewRepository.js
// Data access layer for product_reviews, store_reviews, and driver_reviews tables

const BaseRepository = require('./BaseRepository');

class ReviewRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'product_reviews');
  }

  /**
   * Check all three review tables for a given ID (product, store, driver)
   * returns { id, type } if found, null otherwise
   */
  async findPolymorphicReviewById(id) {
    // Try product
    const { data: p } = await this.db.from('product_reviews').select('id').eq('id', id).single();
    if (p) return { id, type: 'product' };

    // Try store
    const { data: s } = await this.db.from('store_reviews').select('id').eq('id', id).single();
    if (s) return { id, type: 'store' };

    // Try driver
    const { data: d } = await this.db.from('driver_reviews').select('id').eq('id', id).single();
    if (d) return { id, type: 'driver' };

    return null;
  }

  /**
   * Create product review
   * @param {Object} reviewData
   * @returns {Promise<Object>}
   */
  async createProductReview(reviewData) {
    const { data, error } = await this.db
      .from('product_reviews')
      .insert({
        product_id: reviewData.productId,
        buyer_id: reviewData.userId,
        order_id: reviewData.orderId,
        rating: reviewData.rating,
        review_text: reviewData.reviewText || null,
        images: reviewData.images || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create store review
   * @param {Object} reviewData
   * @returns {Promise<Object>}
   */
  async createStoreReview(reviewData) {
    const { data, error } = await this.db
      .from('store_reviews')
      .insert({
        store_id: reviewData.storeId,
        buyer_id: reviewData.userId,
        order_id: reviewData.orderId,
        rating: reviewData.rating,
        review_text: reviewData.reviewText || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create driver review
   * @param {Object} reviewData
   * @returns {Promise<Object>}
   */
  async createDriverReview(reviewData) {
    const { data, error } = await this.db
      .from('driver_reviews')
      .insert({
        driver_id: reviewData.driverId,
        buyer_id: reviewData.userId,
        delivery_id: reviewData.deliveryId,
        rating: reviewData.rating,
        review_text: reviewData.reviewText || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get product reviews with user info
   * @param {string} productId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getProductReviews(productId, options = {}) {
    const { limit = 20, offset = 0, rating } = options;

    let query = this.db
      .from('product_reviews')
      .select(`
        *,
        user:buyer_id (
          id,
          user_profiles (full_name, avatar_url)
        )
      `, { count: 'exact' })
      .eq('product_id', productId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (rating) {
      query = query.eq('rating', rating);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  /**
   * Get store reviews
   * @param {string} storeId
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async getStoreReviews(storeId, options = {}) {
    const { limit = 20, offset = 0, rating } = options;

    let query = this.db
      .from('store_reviews')
      .select(`
        *,
        user:buyer_id (
          id,
          user_profiles (full_name, avatar_url)
        )
      `, { count: 'exact' })
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (rating) {
      query = query.eq('rating', rating);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  /**
   * Get driver reviews
   * @param {string} driverId
   * @param {Object} options
   * @returns {Promise<{ data: Array, count: number }>}
   */
  async getDriverReviews(driverId, options = {}) {
    const { limit = 20, offset = 0, rating } = options;

    let query = this.db
      .from('driver_reviews')
      .select(`
        *,
        user:buyer_id (
          id,
          user_profiles (full_name, avatar_url)
        )
      `, { count: 'exact' })
      .eq('driver_id', driverId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (rating) {
      query = query.eq('rating', rating);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  /**
   * Calculate product average rating
   * @param {string} productId
   * @returns {Promise<Object>}
   */
  async getProductRatingStats(productId) {
    const { data, error } = await this.db
      .from('product_reviews')
      .select('rating')
      .eq('product_id', productId)
      .is('deleted_at', null);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const totalReviews = data.length;
    const sum = data.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = sum / totalReviews;

    const ratingDistribution = data.reduce((acc, review) => {
      acc[review.rating] = (acc[review.rating] || 0) + 1;
      return acc;
    }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews,
      ratingDistribution
    };
  }

  /**
   * Calculate store average rating
   * @param {string} storeId
   * @returns {Promise<Object>}
   */
  async getStoreRatingStats(storeId) {
    const { data, error } = await this.db
      .from('store_reviews')
      .select('rating')
      .eq('store_id', storeId)
      .is('deleted_at', null);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0
      };
    }

    const totalReviews = data.length;
    const sum = data.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = sum / totalReviews;

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews
    };
  }

  /**
   * Calculate driver average rating
   * @param {string} driverId
   * @returns {Promise<Object>}
   */
  async getDriverRatingStats(driverId) {
    const { data, error } = await this.db
      .from('driver_reviews')
      .select('rating')
      .eq('driver_id', driverId)
      .is('deleted_at', null);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0
      };
    }

    const totalReviews = data.length;
    const sum = data.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = sum / totalReviews;

    return {
      averageRating: parseFloat(averageRating.toFixed(2)),
      totalReviews
    };
  }

  /**
   * Check if user has reviewed product
   * @param {string} userId
   * @param {string} productId
   * @returns {Promise<Object|null>}
   */
  async findProductReviewByUser(userId, productId) {
    const { data, error } = await this.db
      .from('product_reviews')
      .select('*')
      .eq('buyer_id', userId)
      .eq('product_id', productId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Check if user has reviewed store
   * @param {string} userId
   * @param {string} storeId
   * @returns {Promise<Object|null>}
   */
  async findStoreReviewByUser(userId, storeId) {
    const { data, error } = await this.db
      .from('store_reviews')
      .select('*')
      .eq('buyer_id', userId)
      .eq('store_id', storeId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Check if user has reviewed driver for delivery
   * @param {string} userId
   * @param {string} deliveryId
   * @returns {Promise<Object|null>}
   */
  async findDriverReviewByDelivery(userId, deliveryId) {
    const { data, error } = await this.db
      .from('driver_reviews')
      .select('*')
      .eq('buyer_id', userId)
      .eq('delivery_id', deliveryId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Update product review
   * @param {string} reviewId
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateProductReview(reviewId, updateData) {
    const { data, error } = await this.db
      .from('product_reviews')
      .update({
        rating: updateData.rating,
        review_text: updateData.reviewText,
        images: updateData.images
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete review (soft delete)
   * @param {string} reviewId
   * @param {string} table
   * @returns {Promise<Object>}
   */
  async deleteReview(reviewId, table) {
    const { data, error } = await this.db
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get user's reviews with pagination
   * @param {string} userId
   * @param {string} type - 'product', 'store', or 'driver'
   * @param {Object} options - { limit, offset, sortBy, ascending }
   * @returns {Promise<{ data: Array, count: number }>}
   */
  async getUserReviews(userId, type = 'product', options = {}) {
    const { limit = 20, offset = 0, sortBy = 'created_at', ascending = false } = options;

    const tables = {
      product: 'product_reviews',
      store: 'store_reviews',
      driver: 'driver_reviews'
    };

    // Allowlist for safe sort fields
    const allowedSortFields = ['created_at', 'rating'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

    const table = tables[type];
    if (!table) throw new Error('Invalid review type');

    const { data, count, error } = await this.db
      .from(table)
      .select('*', { count: 'exact' })
      .eq('buyer_id', userId)
      .is('deleted_at', null)
      .order(safeSortBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  /**
   * Get reviewable products for user (from completed orders)
   * @param {string} userId
   * @param {Object} options - { limit, offset }
   * @returns {Promise<{ data: Array, count: number }>}
   */
  async getReviewableProducts(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    // 1. Get completed orders
    const { data: orders, error: ordersError } = await this.db
      .from('orders')
      .select(`
        id,
        order_items (
          product_id,
          product_title,
          products (
            id,
            title,
            primary_image_url
          )
        )
      `)
      .eq('buyer_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    // 2. Fetch all existing reviews by this user to avoid N+1 queries
    const { data: userReviews, error: reviewsError } = await this.db
      .from('product_reviews')
      .select('product_id')
      .eq('buyer_id', userId)
      .is('deleted_at', null);

    if (reviewsError) throw reviewsError;

    // Create a set of reviewed product IDs for O(1) lookups
    const reviewedProductIds = new Set((userReviews || []).map(r => r.product_id));

    // 3. Filter out already reviewed products (deduplicate by productId)
    const seen = new Set();
    const allReviewable = [];
    for (const order of orders || []) {
      for (const item of order.order_items) {
        if (!reviewedProductIds.has(item.product_id) && !seen.has(item.product_id)) {
          seen.add(item.product_id);
          allReviewable.push({
            orderId: order.id,
            productId: item.product_id,
            product: item.products
          });
        }
      }
    }

    // 4. Apply pagination in-memory (cross-table join makes DB pagination impractical)
    const totalCount = allReviewable.length;
    const paginatedData = allReviewable.slice(offset, offset + limit);

    return { data: paginatedData, count: totalCount };
  }
}

module.exports = ReviewRepository;
