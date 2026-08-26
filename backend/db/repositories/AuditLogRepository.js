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
    const { data, error } = await this.db
      .from(this.tableName)
      .insert({
        user_id:        logData.userId,
        action:         logData.action,
        entity_type:    logData.entityType,
        entity_id:      logData.entityId,
        metadata:       logData.changes || logData.metadata || {},
        ip_address:     logData.ipAddress,
        user_agent:     logData.userAgent,
        status:         logData.status || 'success',
        failure_reason: logData.failureReason || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get audit logs with filters
   * @param {Object} options - { userId, action, entityType, startDate, endDate, search, limit, offset }
   * @returns {Promise<{logs: Array, total: number}>}
   */
  async getAuditLogs(options = {}) {
    const {
      userId, action, entityType, startDate, endDate,
      role, status, search,
      limit = 100, offset = 0,
    } = options;
    const { getPool } = require('../../config/postgres');
    const db = getPool();
    const params = [];
    const conditions = [];

    const joins = `
      FROM audit_logs al
      LEFT JOIN users         u  ON u.id  = al.user_id
      LEFT JOIN user_profiles up ON up.user_id = al.user_id
      LEFT JOIN user_roles    ur ON ur.user_id = al.user_id AND ur.is_active = TRUE
      LEFT JOIN roles         r  ON r.id  = ur.role_id
    `;

    if (userId)     { params.push(userId);     conditions.push(`al.user_id = $${params.length}`); }
    if (action)     { params.push(action);     conditions.push(`al.action = $${params.length}`); }
    if (entityType) { params.push(entityType); conditions.push(`al.entity_type = $${params.length}`); }
    if (startDate)  { params.push(startDate);  conditions.push(`al.timestamp >= $${params.length}`); }
    if (endDate)    { params.push(endDate);    conditions.push(`al.timestamp <= $${params.length}`); }
    if (role)       { params.push(role);       conditions.push(`r.name = $${params.length}`); }
    if (status)     { params.push(status);     conditions.push(`al.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(al.action ILIKE $${params.length} OR al.entity_type ILIKE $${params.length} OR up.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: countRows } = await db.query(`SELECT COUNT(*) ${joins} ${where}`, params);
    const total = Number.parseInt(countRows[0].count, 10);

    const dataParams = [...params, limit, offset];
    const { rows } = await db.query(
      `SELECT al.*, u.id AS actor_id, u.email AS actor_email, up.full_name AS actor_full_name, r.name AS actor_role
       ${joins}
       ${where}
       ORDER BY al.timestamp DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return {
      logs: rows.map(log => ({
        ...log,
        actor: {
          id:        log.actor_id,
          email:     log.actor_email,
          full_name: log.actor_full_name,
          role:      log.actor_role,
        },
      })),
      total,
    };
  }

  /**
   * Get logs for specific entity
   * @param {string} entityId - Entity ID
   * @param {string} entityType - Entity type
   * @returns {Promise<Array>} Entity audit trail
   */
  async getEntityHistory(entityId, entityType) {
    const { getPool } = require('../../config/postgres');
    const db = getPool();

    const { rows } = await db.query(`
      SELECT
        al.*,
        u.id    AS actor_id,
        u.email AS actor_email,
        up.full_name AS actor_full_name
      FROM audit_logs al
      LEFT JOIN users u          ON u.id = al.user_id
      LEFT JOIN user_profiles up ON up.user_id = al.user_id
      WHERE al.entity_id = $1 AND al.entity_type = $2
      ORDER BY al.timestamp DESC
    `, [entityId, entityType]);

    return rows.map(log => ({
      ...log,
      user: {
        id:        log.actor_id,
        email:     log.actor_email,
        full_name: log.actor_full_name,
      },
    }));
  }

  /**
   * Get user activity logs
   * @param {string} userId - User ID
   * @param {Object} options - { limit, offset }
   * @returns {Promise<Array>} User activity logs
   */
  async getUserActivity(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const { data, error } = await this.db
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

    let query = this.db
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

    const { data, error } = await this.db
      .from(this.tableName)
      .delete()
      .lt('timestamp', cutoffDate.toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  }
}

module.exports = AuditLogRepository;
