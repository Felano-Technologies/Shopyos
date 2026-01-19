// db/repositories/UserProfileRepository.js
// Data access layer for user_profiles table

const BaseRepository = require('./BaseRepository');

class UserProfileRepository extends BaseRepository {
  constructor(supabaseClient) {
    super(supabaseClient, 'user_profiles');
  }

  /**
   * Find profile by user ID
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Update profile by user ID
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateByUserId(userId, updates) {
    const { data, error } = await this.db
      .from(this.tableName)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Search profiles by name, phone, or email
   * @param {string} searchTerm
   * @param {Object} options
   * @returns {Promise<Array>}
   */
  async searchProfiles(searchTerm, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let query = this.db
      .from(this.tableName)
      .select('*, users!inner(email, is_active)', { count: 'exact' })
      .or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      .eq('users.is_active', true);

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('full_name', { ascending: true });

    if (error) throw error;

    return {
      profiles: data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  }
}

module.exports = UserProfileRepository;
