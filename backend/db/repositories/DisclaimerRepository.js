// db/repositories/DisclaimerRepository.js
const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

class DisclaimerRepository extends BaseRepository {
  constructor(client) {
    super(client, 'platform_disclaimers');
  }

  async getByType(type) {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT * FROM platform_disclaimers WHERE type = $1 AND is_active = TRUE',
      [type]
    );
    return rows[0] || null;
  }

  async getAllActive() {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT * FROM platform_disclaimers WHERE is_active = TRUE ORDER BY type'
    );
    return rows;
  }

  async updateDisclaimer(type, title, content, version, updatedBy) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE platform_disclaimers
       SET title = $1, content = $2, version = $3, updated_by = $4, updated_at = NOW()
       WHERE type = $5
       RETURNING *`,
      [title, content, version, updatedBy, type]
    );
    return rows[0] || null;
  }

  async createAcknowledgement(userId, type, version, contextId = null, contextType = null, ipAddress = null, deviceInfo = null) {
    const db = getPool();
    const { rows } = await db.query(
      `INSERT INTO disclaimer_acknowledgements (
         user_id, disclaimer_type, version, context_id, context_type, ip_address, device_info
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, type, version, contextId, contextType, ipAddress, deviceInfo]
    );
    return rows[0];
  }

  async checkAcknowledgement(userId, type, version = null, contextId = null) {
    const db = getPool();
    let query = 'SELECT * FROM disclaimer_acknowledgements WHERE user_id = $1 AND disclaimer_type = $2';
    const params = [userId, type];

    if (version) {
      params.push(version);
      query += ` AND version = $${params.length}`;
    }
    if (contextId) {
      params.push(contextId);
      query += ` AND context_id = $${params.length}`;
    }

    query += ' ORDER BY acknowledged_at DESC LIMIT 1';
    const { rows } = await db.query(query, params);
    return rows[0] || null;
  }

  async getAcknowledgementsAudit(type = null, limit = 50) {
    const db = getPool();
    let query = `
      SELECT a.*, u.email as user_email, up.full_name as user_full_name
      FROM disclaimer_acknowledgements a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN user_profiles up ON a.user_id = up.user_id
    `;
    const params = [];

    if (type) {
      params.push(type);
      query += ' WHERE a.disclaimer_type = $1';
    }

    params.push(limit);
    query += ` ORDER BY a.acknowledged_at DESC LIMIT $${params.length}`;

    const { rows } = await db.query(query, params);
    return rows;
  }
}

module.exports = DisclaimerRepository;
