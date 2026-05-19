// db/repositories/ScheduledNotificationRepository.js
// Manages CRUD and poll-queries for the scheduled_notifications table.

const BaseRepository = require('./BaseRepository');

class ScheduledNotificationRepository extends BaseRepository {
  constructor(dbClient) {
    super(dbClient, 'scheduled_notifications');
  }

  /**
   * Return all pending manual rows whose scheduled_at has passed.
   * Called every minute by the scheduler worker.
   * @returns {Promise<Array>}
   */
  async getDueManualNotifications() {
    const { data, error } = await this.db
      .from(this.tableName)
      .select('*')
      .eq('status', 'pending')
      .eq('campaign_type', 'manual')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Return paginated list for the admin UI.
   * @param {{ limit?: number, offset?: number, status?: string, campaign_type?: string }} opts
   */
  async listForAdmin(opts = {}) {
    const { limit = 20, offset = 0, status, campaign_type } = opts;

    let query = this.db
      .from(this.tableName)
      .select('*')
      .order('scheduled_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (campaign_type) query = query.eq('campaign_type', campaign_type);

    // range is inclusive: rows [offset, offset+limit-1]
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Count rows for pagination metadata.
   * @param {{ status?: string, campaign_type?: string }} opts
   */
  async countForAdmin(opts = {}) {
    const { status, campaign_type } = opts;

    let query = this.db
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (status) query = query.eq('status', status);
    if (campaign_type) query = query.eq('campaign_type', campaign_type);

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }
}

module.exports = ScheduledNotificationRepository;
