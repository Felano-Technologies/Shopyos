const { Pool } = require('pg');

let pool = null;

const getSslConfig = () => {
  const raw = (process.env.PG_SSL || '').trim().toLowerCase();

  if (!raw) return undefined;
  if (['false', '0', 'no', 'off', 'disable', 'disabled'].includes(raw)) return false;
  if (['true', '1', 'yes', 'on', 'require', 'enabled'].includes(raw)) {
    return { rejectUnauthorized: false };
  }

  return undefined;
};

const getPool = () => {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for socket service');
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
    console.error('Socket Postgres pool error:', error.message);
  });

  return pool;
};

module.exports = { getPool };
