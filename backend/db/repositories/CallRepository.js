// db/repositories/CallRepository.js
// Data access for the in-app call ledger (calls table).

const BaseRepository = require('./BaseRepository');

class CallRepository extends BaseRepository {
  constructor(client) {
    super(client, 'calls');
  }

  async createCall(data) {
    return this.create(data);
  }

  async updateCall(id, data) {
    return this.update(id, data);
  }

  async getCallWithParticipants(id) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        caller:caller_id (id, email, user_profiles (full_name, phone, avatar_url)),
        receiver:receiver_id (id, email, user_profiles (full_name, phone, avatar_url))
      `)
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async getCallsForUser(userId, { limit = 50, offset = 0 } = {}) {
    const { data, error } = await this.db
      .from(this.tableName)
      .select(`
        *,
        caller:caller_id (id, email, user_profiles (full_name, avatar_url)),
        receiver:receiver_id (id, email, user_profiles (full_name, avatar_url))
      `)
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  }

  async getAllCallsAdmin({ status, from, to, limit = 50, offset = 0 } = {}) {
    let q = this.db
      .from(this.tableName)
      .select(`
        *,
        caller:caller_id (id, email, user_profiles (full_name)),
        receiver:receiver_id (id, email, user_profiles (full_name)),
        order:order_id (id, order_number)
      `)
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);
    q = q.range(offset, offset + limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }
}

module.exports = CallRepository;
