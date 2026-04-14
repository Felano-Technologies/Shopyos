require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool } = require('../config/postgres');

const pool = getPool();
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const LOCK_KEY = 948372611;

const checksum = (content) => crypto.createHash('sha256').update(content).digest('hex');

const getMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
};

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  const applied = new Map();
  rows.forEach((row) => applied.set(row.filename, row.checksum));
  return applied;
}

async function applyMigrationFile(client, fileName) {
  const fullPath = path.join(MIGRATIONS_DIR, fileName);
  const sql = fs.readFileSync(fullPath, 'utf8');
  const sqlTrimmed = sql.trim();

  if (!sqlTrimmed) {
    console.log(`⚪ Skipping empty migration: ${fileName}`);
    return;
  }

  const hash = checksum(sql);
  console.log(`➡️  Applying migration: ${fileName}`);

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
      [fileName, hash]
    );
    await client.query('COMMIT');
    console.log(`✅ Applied: ${fileName}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration failed for ${fileName}: ${error.message}`);
  }
}

async function run() {
  const client = await pool.connect();

  try {
    console.log('==================================================');
    console.log('🛠️  Shopyos SQL Migration Runner');
    console.log('==================================================');

    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await ensureMigrationsTable(client);

    const files = getMigrationFiles();
    const applied = await getAppliedMigrations(client);

    let appliedCount = 0;

    for (const fileName of files) {
      const fullPath = path.join(MIGRATIONS_DIR, fileName);
      const content = fs.readFileSync(fullPath, 'utf8');
      const hash = checksum(content);

      if (applied.has(fileName)) {
        if (applied.get(fileName) !== hash) {
          throw new Error(
            `Checksum mismatch for already-applied migration ${fileName}. ` +
            'Do not edit old migrations; add a new migration file instead.'
          );
        }
        console.log(`⏭️  Already applied: ${fileName}`);
        continue;
      }

      await applyMigrationFile(client, fileName);
      appliedCount += 1;
    }

    console.log('--------------------------------------------------');
    console.log(`✨ Migration run complete. New migrations applied: ${appliedCount}`);
    console.log('--------------------------------------------------');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
    await pool.end().catch(() => {});
  }
}

run().catch((error) => {
  console.error('❌ Migration runner failed:', error.message);
  process.exit(1);
});
