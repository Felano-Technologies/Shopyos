// db/repositories/FeeConfigRepository.js
const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

class FeeConfigRepository extends BaseRepository {
  constructor(client) {
    super(client, 'platform_fee_config');
  }

  async getAll() {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT * FROM platform_fee_config ORDER BY category, config_key'
    );
    return rows;
  }

  async getByKey(key) {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT * FROM platform_fee_config WHERE config_key = $1',
      [key]
    );
    return rows[0] || null;
  }

  async getByCategory(category) {
    const db = getPool();
    const { rows } = await db.query(
      'SELECT * FROM platform_fee_config WHERE category = $1 ORDER BY config_key',
      [category]
    );
    return rows;
  }

  async updateByKey(key, newValue, updatedBy, reason = null) {
    const db = getPool();
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const oldConfig = await this._fetchOldConfigForUpdate(client, key);
      const updatedConfig = await this._updateConfigValue(client, key, newValue, updatedBy);
      await this._insertAuditLog(client, key, oldConfig?.config_value, newValue, updatedBy, reason);

      await client.query('COMMIT');
      return updatedConfig;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async _fetchOldConfigForUpdate(client, key) {
    const { rows } = await client.query(
      'SELECT config_value FROM platform_fee_config WHERE config_key = $1 FOR UPDATE',
      [key]
    );
    if (!rows.length) {
      throw new Error(`Config parameter ${key} not found`);
    }
    return rows[0];
  }

  async _updateConfigValue(client, key, newValue, updatedBy) {
    const { rows } = await client.query(
      `UPDATE platform_fee_config
       SET config_value = $1, updated_by = $2, updated_at = NOW()
       WHERE config_key = $3
       RETURNING *`,
      [newValue, updatedBy, key]
    );
    return rows[0];
  }

  async _insertAuditLog(client, key, oldValue, newValue, changedBy, reason) {
    await client.query(
      `INSERT INTO fee_config_audit (config_key, old_value, new_value, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [key, oldValue, newValue, changedBy, reason]
    );
  }

  async getAuditLog(key, limit = 50) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT a.*, u.email as changed_by_email
       FROM fee_config_audit a
       LEFT JOIN users u ON a.changed_by = u.id
       WHERE a.config_key = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [key, limit]
    );
    return rows;
  }
}

module.exports = FeeConfigRepository;
