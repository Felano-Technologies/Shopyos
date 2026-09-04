// db/repositories/PromoCodeRepository.js
// Data access layer for promo_codes table

const BaseRepository = require('./BaseRepository');

class PromoCodeRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'promo_codes');
  }

  /**
   * Find a promo code by its code, case-insensitive.
   * @param {string} code
   * @returns {Promise<Object|null>}
   */
  async findByCode(code) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .ilike('code', code)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * List a store's own promo codes, newest first.
   * @param {string} storeId
   * @returns {Promise<Array>}
   */
  async findByStore(storeId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * List all promo codes for admin moderation, optionally filtered.
   * @param {Object} filters
   * @param {string} [filters.storeId]
   * @param {boolean} [filters.isActive]
   * @returns {Promise<Array>}
   */
  async findAllAdmin({ storeId, isActive } = {}) {
    let q = this.db
      .from(this.tableName)
      .select('*, store:store_id (store_name)')
      .order('created_at', { ascending: false });

    if (storeId) q = q.eq('store_id', storeId);
    if (isActive !== undefined) q = q.eq('is_active', isActive);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  /**
   * Deactivate a promo code (soft revoke — never hard-deleted since orders
   * reference it via promo_code_id).
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async deactivate(id) {
    return this.update(id, { is_active: false });
  }
}

module.exports = PromoCodeRepository;
