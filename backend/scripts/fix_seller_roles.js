// backend/scripts/fix_seller_roles.js
// Script to ensure all store owners have the 'seller' role assigned.
// Uses PG directly to match the project's backend setup.

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixRoles() {
  console.log('🔍 Starting Seller Role Fix...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get all stores and their owners
    const { rows: stores } = await client.query('SELECT owner_id, store_name FROM stores');
    console.log(`📋 Found ${stores.length} stores.`);

    // 2. Get the seller role ID
    const { rows: roles } = await client.query("SELECT id FROM roles WHERE name = 'seller'");
    if (roles.length === 0) {
      throw new Error("Role 'seller' not found in database.");
    }
    const sellerRoleId = roles[0].id;
    console.log(`✅ Seller Role ID: ${sellerRoleId}`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const store of stores) {
      const userId = store.owner_id;

      // Check if user already has the role
      const { rows: existing } = await client.query(
        'SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2 AND is_active = TRUE',
        [userId, sellerRoleId]
      );

      if (existing.length === 0) {
        console.log(`➕ Assigning 'seller' role to owner of "${store.store_name}"...`);
        await client.query(
          'INSERT INTO user_roles (user_id, role_id, is_active) VALUES ($1, $2, TRUE) ON CONFLICT (user_id, role_id) DO UPDATE SET is_active = TRUE',
          [userId, sellerRoleId]
        );
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    await client.query('COMMIT');
    console.log('\n✨ Fix Complete!');
    console.log(`🚀 Roles Assigned/Updated: ${fixedCount}`);
    console.log(`⏩ Already Correct: ${skippedCount}`);
    console.log('\n💡 IMPORTANT: If you are still seeing "Access Denied" in the app, please log out and log back in.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 Critical Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRoles();
