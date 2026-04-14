require('dotenv').config();

const { getPool } = require('../config/postgres');
const pgPool = getPool();

/**
 * Check if required tables exist in the database
 */
async function checkSchema() {
  console.log('🔍 Checking database schema (postgres)...');
  const tablesToCheck = ['payouts', 'balance_logs', 'promoted_products', 'banner_campaigns', 'conversations', 'messages'];

  for (const table of tablesToCheck) {
    try {
      await pgPool.query(`SELECT id FROM ${table} LIMIT 1`);
      console.log(`✅ Table '${table}' exists.`);
    } catch (error) {
      if (error.code === '42P01') {
        console.log(`⚠️  Table '${table}' is MISSING. Please run migration SQL against Postgres.`);
      } else {
        console.log(`❓ Table '${table}' check error:`, error.message);
      }
    }
  }
}

/**
 * Ensure default roles exist
 */
async function ensureRolesExist() {
  console.log('\n🚀 Ensuring default roles exist...');

  const roles = [
    { name: 'buyer', display_name: 'Buyer', description: 'Can browse products, make purchases, and leave reviews' },
    { name: 'seller', display_name: 'Seller', description: 'Can create stores, list products, and manage orders' },
    { name: 'driver', display_name: 'Driver', description: 'Can accept and complete delivery assignments' },
    { name: 'admin', display_name: 'Administrator', description: 'Full system access' }
  ];

  for (const role of roles) {
    const existing = await pgPool.query('SELECT id FROM roles WHERE name = $1 LIMIT 1', [role.name]);
    if (existing.rows.length === 0) {
      try {
        await pgPool.query(
          'INSERT INTO roles (name, display_name, description) VALUES ($1, $2, $3)',
          [role.name, role.display_name, role.description]
        );
        console.log(`✅ Created role: ${role.name}`);
      } catch (error) {
        console.log(`❌ Role '${role.name}' creation failed:`, error.message);
      }
    } else {
      console.log(`✓  Role '${role.name}' ready.`);
    }
  }
}

/**
 * Run all migration checks
 */
async function run() {
  console.log('==================================================');
  console.log('🛠️  Shopyos Database Migration & Setup Tool');
  console.log('==================================================\n');
  console.log('Database client mode: postgres\n');

  try {
    await checkSchema();
    await ensureRolesExist();

    console.log('\n' + '='.repeat(50));
    console.log('✨ Setup verification complete!');
    console.log('='.repeat(50));
  } catch (err) {
    console.error('\n❌ Unexpected error during setup:', err.message);
    process.exit(1);
  } finally {
    await pgPool.end().catch(() => {});
  }
}

run();
