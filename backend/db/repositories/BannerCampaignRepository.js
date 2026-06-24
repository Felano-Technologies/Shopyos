const BaseRepository = require('./BaseRepository');

class BannerCampaignRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'banner_campaigns');
  }

  async createCampaign(data) {
    const { data: campaign, error } = await this.db
      .from(this.tableName)
      .insert(data)
      .select('*, store:stores(store_name), product:products(id, name, price, image_url)')
      .single();

    if (error) throw error;
    return campaign;
  }

  async getMyCampaigns(storeId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*, store:stores(store_name), product:products(id, name, price, image_url)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getAllCampaigns() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*, store:stores(store_name, owner_id), product:products(id, name, price, image_url)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateCampaign(id, updateData) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getActiveBanners() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*, store:stores(id, store_name, logo_url), product:products(id, name, price, image_url)')
      .eq('status', 'Active')
      .order('impressions', { ascending: false });
    if (error) throw error;

    // Filter out expired campaigns — don't serve banners past their end_date
    const now = new Date();
    return (data || []).filter(b => !b.end_date || new Date(b.end_date) >= now);
  }

  async recordClick(campaignId) {
    const { error } = await this.db.rpc('record_banner_click', {
      p_campaign_id: campaignId
    });
    if (error) throw error;
    return true;
  }

  async recordImpression(campaignId) {
    const { error } = await this.db.rpc('record_banner_impression', {
      p_campaign_id: campaignId
    });
    if (error) throw error;
    return true;
  }
}

module.exports = BannerCampaignRepository;
