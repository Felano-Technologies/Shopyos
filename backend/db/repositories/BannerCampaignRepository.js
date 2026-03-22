const BaseRepository = require('./BaseRepository');

class BannerCampaignRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'banner_campaigns');
  }

  async createCampaign(data) {
    const { data: campaign, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select('*, store:stores(store_name)')
      .single();

    if (error) throw error;
    return campaign;
  }

  async getMyCampaigns(storeId) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*, store:stores(store_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getAllCampaigns() {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*, store:stores(store_name, owner_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateCampaign(id, updateData) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getActiveBanners() {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('status', 'Active')
      .order('impressions', { ascending: false });
    if (error) throw error;
    return data;
  }
}

module.exports = BannerCampaignRepository;
