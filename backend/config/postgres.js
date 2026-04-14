const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const min = parseInt(process.env.PG_POOL_MIN || '2', 10);
  const max = parseInt(process.env.PG_POOL_MAX || '10', 10);

  pool = new Pool({
    connectionString: databaseUrl,
    min,
    max,
    ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

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
