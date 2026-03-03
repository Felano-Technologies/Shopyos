// db/repositories/AuditLogRepository.js
// Repository for tracking admin actions and system events

const BaseRepository = require('./BaseRepository');

class AuditLogRepository extends BaseRepository {
  constructor(supabase) {
    super(supabase, 'audit_logs');
  }

  /**
   * Create audit log entry
   * @param {Object} logData - { userId, action, entityType, entityId, changes, ipAddress, userAgent }
   * @returns {Promise<Object>} Created log entry
   */
  async createLog(logData) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert({
        user_id: logData.userId,
        action: logData.action,
        entity_type: logData.entityType,
        entity_id: logData.entityId,
        metadata: logData.changes || logData.metadata || {},
        ip_address: logData.ipAddress,
        user_agent: logData.userAgent
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get audit logs with filters
   * @param {Object} options - { userId, action, entityType, startDate, endDate, limit, offset }
   * @returns {Promise<Array>} List of audit logs
   */
  async getAuditLogs(options = {}) {
    const { userId, action, entityType, startDate, endDate, limit = 100, offset = 0 } = options;

    let query = this.supabase
      .from(this.tableName)
      .select(`
        *,
        user:users!user_id(id, email, user_profiles(full_name))
      `)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (startDate) {
      query = query.gte('timestamp', startDate);
    }

    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Get logs for specific entity
   * @param {string} entityId - Entity ID
   * @param {string} entityType - Entity type
   * @returns {Promise<Array>} Entity audit trail
   */
  async getEntityHistory(entityId, entityType) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(`
        *,
        user:users!user_id(id, email, user_profiles(full_name))
      `)
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Get user activity logs
   * @param {string} userId - User ID
   * @param {Object} options - { limit, offset }
   * @returns {Promise<Array>} User activity logs
   */
  async getUserActivity(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  /**
   * Get audit statistics
   * @param {Object} options - { startDate, endDate }
   * @returns {Promise<Object>} Audit statistics
   */
  async getAuditStats(options = {}) {
    const { startDate, endDate } = options;

    let query = this.supabase
      .from(this.tableName)
      .select('action, entity_type');

    if (startDate) {
      query = query.gte('timestamp', startDate);
    }

    if (endDate) {
      query = query.lte('timestamp', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      totalActions: data?.length || 0,
      byAction: {},
      byEntityType: {}
    };

    data?.forEach(log => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      stats.byEntityType[log.entity_type] = (stats.byEntityType[log.entity_type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clean up old audit logs (utility for maintenance)
   * @param {number} daysOld - Delete logs older than this many days
   * @returns {Promise<number>} Number of deleted logs
   */
  async cleanupOldLogs(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  }
}

module.exports = AuditLogRepository;
