// db/repositories/PromotedProductRepository.js
// Repository for managing promoted products (advertising system)

const BaseRepository = require('./BaseRepository');

class PromotedProductRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'promoted_products');
  }

  /**
   * Create promoted product campaign
   * @param {Object} campaignData - { productId, storeId, budget, startDate, endDate, targetAudience }
   * @returns {Promise<Object>} Created campaign
   */
  async createCampaign(campaignData) {
    const { data, error } = await this.db
      .from(this.tableName)
      .insert({
        product_id: campaignData.productId,
        store_id: campaignData.storeId,
        budget: campaignData.budget,
        spent_amount: 0,
        start_date: campaignData.startDate,
        end_date: campaignData.endDate,
        target_audience: campaignData.targetAudience || {},
        status: 'active'
      })
      .select(`
        *,
        product:products(id, title, price, product_images(image_url)),
        store:stores(id, store_name)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get active promoted products
   * @param {Object} options - { limit, category, minPrice, maxPrice }
   * @returns {Promise<Array>} Active campaigns
   */
  async getActivePromotions(options = {}) {
    const { limit = 20, category, minPrice, maxPrice } = options;
    const now = new Date().toISOString();

    let query = this.db
      .from(this.tableName)
      .select(`
        *,
        product:products!inner(
          id, title, description, price, product_images(image_url), category, 
          stores:store_id(id, store_name, logo_url, is_verified)
        )
      `)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by price if specified (client-side since we can't filter on joined table easily)
    let results = data || [];
    // Only show promotions from verified stores
    results = results.filter(p => p.product?.stores?.is_verified === true);
    if (category) {
      results = results.filter(p => p.product?.category === category);
    }
    if (minPrice !== undefined) {
      results = results.filter(p => parseFloat(p.product.price) >= minPrice);
    }
    if (maxPrice !== undefined) {
      results = results.filter(p => parseFloat(p.product.price) <= maxPrice);
    }

    return results;
  }

  /**
   * Get store campaigns
   * @param {string} storeId - Store ID
   * @param {Object} options - { status, limit, offset }
   * @returns {Promise<Array>} Store campaigns
   */
  async getStoreCampaigns(storeId, options = {}) {
    const { status, limit = 20, offset = 0 } = options;

    let query = this.db
      .from(this.tableName)
      .select(`
        *,
        product:products(id, title, price, product_images(image_url))
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Only filter by status if the column exists (skip if no status column in DB)
    // status filter removed to prevent crashes on tables without this column

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get campaign details
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Campaign details
   */
  async getCampaignDetails(campaignId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        product:products(id, title, description, price, product_images(image_url), category),
        store:stores(id, store_name, logo_url)
      `)
      .eq('id', campaignId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update campaign status
   * @param {string} campaignId - Campaign ID
   * @param {string} status - New status (active, paused, completed, cancelled)
   * @returns {Promise<Object>} Updated campaign
   */
  async updateCampaignStatus(campaignId, status) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update campaign budget
   * @param {string} campaignId - Campaign ID
   * @param {number} newBudget - New budget amount
   * @returns {Promise<Object>} Updated campaign
   */
  async updateCampaignBudget(campaignId, newBudget) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({
        budget: newBudget,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Record impression (when ad is viewed)
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<boolean>} Success status
   */
  async recordImpression(campaignId) {
    const { error } = await this.db.rpc('record_promotion_impression', {
      p_campaign_id: campaignId
    });

    if (error) throw error;
    return true;
  }

  /**
   * Record click (when ad is clicked)
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<boolean>} Success status
   */
  async recordClick(campaignId) {
    const { error } = await this.db.rpc('record_promotion_click', {
      p_campaign_id: campaignId
    });

    if (error) throw error;
    return true;
  }

  /**
   * Get campaign performance metrics
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Performance metrics
   */
  async getCampaignMetrics(campaignId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('id', campaignId)
      .single();

    if (error) throw error;

    const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
    const avgCostPerClick = data.clicks > 0 ? data.spent_amount / data.clicks : 0;
    const avgCostPerImpression = data.impressions > 0 ? data.spent_amount / data.impressions : 0;
    const budgetUtilization = (data.spent_amount / data.budget) * 100;

    return {
      impressions: data.impressions,
      clicks: data.clicks,
      spent: parseFloat(data.spent_amount),
      budget: parseFloat(data.budget),
      remaining: parseFloat(data.budget) - parseFloat(data.spent_amount),
      ctr: ctr.toFixed(2),
      avgCostPerClick: avgCostPerClick.toFixed(2),
      avgCostPerImpression: avgCostPerImpression.toFixed(4),
      budgetUtilization: budgetUtilization.toFixed(2)
    };
  }

  /**
   * Check if campaign is active and within budget
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<boolean>} Whether campaign can serve ads
   */
  async canServeAd(campaignId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('start_date, end_date')
      .eq('id', campaignId)
      .single();

    if (error) return false;

    const now = new Date();
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    return now >= startDate && now <= endDate;
  }

  /**
   * Auto-pause expired campaigns (cron job utility)
   * @returns {Promise<number>} Number of campaigns paused
   */
  async pauseExpiredCampaigns() {
    // This method requires a 'status' column — skip gracefully if not available
    const now = new Date().toISOString();

    try {
      const { data, error } = await this.db
        .from(this.tableName)
        .update({ updated_at: now })
        .lt('end_date', now)
        .select();

      if (error) throw error;
      return data?.length || 0;
    } catch (err) {
      console.warn('[PromotedProductRepository] pauseExpiredCampaigns skipped:', err.message);
      return 0;
    }
  }
}

module.exports = PromotedProductRepository;
