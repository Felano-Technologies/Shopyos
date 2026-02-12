const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Check if required tables exist in the database
 */
async function checkSchema() {
  console.log('🔍 Checking database schema...');
  const tablesToCheck = ['payouts', 'balance_logs', 'promoted_products', 'conversations', 'messages'];

  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('id').limit(1);

    if (error && error.code === '42P01') {
      console.log(`⚠️  Table '${table}' is MISSING. Please run the migration SQL in Supabase Dashboard.`);
    } else if (error && error.code !== 'PGRST116') {
      // Ignore empty table error (PGRST116), but report others
      console.log(`❓ Table '${table}' check error:`, error.message);
    } else {
      console.log(`✅ Table '${table}' exists.`);
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
    const { data: existing } = await supabase.from('roles').select('id').eq('name', role.name).single();

    if (!existing) {
      const { error } = await supabase.from('roles').insert([role]);
      if (error) console.log(`❌ Role '${role.name}' creation failed:`, error.message);
      else console.log(`✅ Created role: ${role.name}`);
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

  try {
    await checkSchema();
    await ensureRolesExist();

    console.log('\n' + '='.repeat(50));
    console.log('✨ Setup verification complete!');
    console.log('='.repeat(50));
  } catch (err) {
    console.error('\n❌ Unexpected error during setup:', err.message);
    process.exit(1);
  }
}

run();
