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
    const { data, error } = await this.supabase
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
        product:products(id, product_name, price, images),
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

    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        product:products!inner(
          id, product_name, description, price, images, category, 
          stores:store_id(id, store_name, logo)
        )
      `)
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('impressions', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('product.category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter by price if specified (client-side since we can't filter on joined table easily)
    let results = data || [];
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

    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        product:products(id, product_name, price, images)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

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
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        product:products(id, product_name, description, price, images, category),
        store:stores(id, store_name, logo)
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
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
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
    const costPerImpression = 0.01; // GHS 0.01 per impression

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('impressions, spent_amount, budget')
      .eq('id', campaignId)
      .single();

    if (error) throw error;

    const newSpent = parseFloat(data.spent_amount) + costPerImpression;
    const newImpressions = data.impressions + 1;

    // Check if budget exceeded
    if (newSpent >= parseFloat(data.budget)) {
      // Pause campaign if budget exhausted
      await this.updateCampaignStatus(campaignId, 'paused');
    }

    const { error: updateError } = await this.supabase
      .from(this.tableName)
      .update({
        impressions: newImpressions,
        spent_amount: newSpent,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;
    return true;
  }

  /**
   * Record click (when ad is clicked)
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<boolean>} Success status
   */
  async recordClick(campaignId) {
    const costPerClick = 0.10; // GHS 0.10 per click

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('clicks, spent_amount, budget')
      .eq('id', campaignId)
      .single();

    if (error) throw error;

    const newSpent = parseFloat(data.spent_amount) + costPerClick;
    const newClicks = data.clicks + 1;

    // Check if budget exceeded
    if (newSpent >= parseFloat(data.budget)) {
      await this.updateCampaignStatus(campaignId, 'paused');
    }

    const { error: updateError } = await this.supabase
      .from(this.tableName)
      .update({
        clicks: newClicks,
        spent_amount: newSpent,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    if (updateError) throw updateError;
    return true;
  }

  /**
   * Get campaign performance metrics
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Performance metrics
   */
  async getCampaignMetrics(campaignId) {
    const { data, error } = await this.supabase
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
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('status, start_date, end_date, budget, spent_amount')
      .eq('id', campaignId)
      .single();

    if (error) return false;

    const now = new Date();
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    return (
      data.status === 'active' &&
      now >= startDate &&
      now <= endDate &&
      parseFloat(data.spent_amount) < parseFloat(data.budget)
    );
  }

  /**
   * Auto-pause expired campaigns (cron job utility)
   * @returns {Promise<number>} Number of campaigns paused
   */
  async pauseExpiredCampaigns() {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update({ status: 'completed' })
      .eq('status', 'active')
      .lt('end_date', now)
      .select();

    if (error) throw error;
    return data?.length || 0;
  }
}

module.exports = PromotedProductRepository;
