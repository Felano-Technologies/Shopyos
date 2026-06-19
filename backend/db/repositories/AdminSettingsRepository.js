// db/repositories/AdminSettingsRepository.js
const BaseRepository = require('./BaseRepository');
const { getPool } = require('../../config/postgres');

const DEFAULTS = { maintenance_mode: false, auto_approve_sellers: false };

class AdminSettingsRepository extends BaseRepository {
  constructor(client) {
    super(client, 'platform_settings');
  }

  async getSettings() {
    const db = getPool();
    const { rows } = await db.query('SELECT * FROM platform_settings LIMIT 1');
    return rows[0] ?? { ...DEFAULTS };
  }

  async updateSettings(updates, updatedBy) {
    const allowed = ['maintenance_mode', 'auto_approve_sellers'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k))
    );
    if (!Object.keys(filtered).length) throw new Error('No valid fields to update');

    const db = getPool();
    const setClauses = Object.keys(filtered).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = [...Object.values(filtered), new Date(), updatedBy];
    const updatedByIdx = values.length;
    const updatedAtIdx = values.length - 1;

    const { rows } = await db.query(
      `UPDATE platform_settings
         SET ${setClauses}, updated_at = $${updatedAtIdx}, updated_by = $${updatedByIdx}
       RETURNING *`,
      values
    );

    // If no row existed yet, insert one
    if (!rows.length) {
      const { rows: inserted } = await db.query(
        `INSERT INTO platform_settings (maintenance_mode, auto_approve_sellers, updated_by)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [
          filtered.maintenance_mode ?? DEFAULTS.maintenance_mode,
          filtered.auto_approve_sellers ?? DEFAULTS.auto_approve_sellers,
          updatedBy,
        ]
      );
      return inserted[0] ?? { ...DEFAULTS };
    }
    return rows[0];
  }
}

module.exports = AdminSettingsRepository;
