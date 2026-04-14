const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (pool) return pool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for socket service');
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
    console.error('Socket Postgres pool error:', error.message);
  });

  return pool;
};

module.exports = { getPool };
