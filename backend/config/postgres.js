const { Pool } = require('pg');

let pool = null;

const getSslConfig = () => {
  const raw = (process.env.PG_SSL || '').trim().toLowerCase();

  if (!raw) {
    // Leave undefined so node-postgres can rely on DATABASE_URL params/defaults.
    return undefined;
  }

  if (['false', '0', 'no', 'off', 'disable', 'disabled'].includes(raw)) {
    return false;
  }

  if (['true', '1', 'yes', 'on', 'require', 'enabled'].includes(raw)) {
    return { rejectUnauthorized: false };
  }

  // Unknown value: fail open to default behavior.
  return undefined;
};

const getPool = () => {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const min = parseInt(process.env.PG_POOL_MIN || '2', 10);
  const max = parseInt(process.env.PG_POOL_MAX || '10', 10);

  const config = {
    connectionString: databaseUrl,
    min,
    max,
  };

  const sslConfig = getSslConfig();
  if (sslConfig !== undefined) {
    config.ssl = sslConfig;
  }

  pool = new Pool(config);

  pool.on('error', (error) => {
    console.error('Postgres pool error:', error.message);
  });

  return pool;
};

const testConnection = async () => {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    console.log('✅ Postgres connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Postgres connection failed:', error.message);
    return false;
  }
};

module.exports = {
  getPool,
  testConnection,
};
