const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function ensureRolesExist() {
  console.log('🚀 Ensuring default roles exist in database...\n');

  const roles = [
    { name: 'buyer', display_name: 'Buyer', description: 'Can browse products, make purchases, and leave reviews' },
    { name: 'seller', display_name: 'Seller', description: 'Can create stores, list products, and manage orders' },
    { name: 'driver', display_name: 'Driver', description: 'Can accept and complete delivery assignments' }
  ];

  let createdCount = 0;
  let existingCount = 0;
  let errorCount = 0;

  for (const role of roles) {
    try {
      // Check if role exists
      const { data: existing, error: checkError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('name', role.name)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // Role doesn't exist (PGRST116 = no rows returned), create it
        const { data, error: insertError } = await supabase
          .from('roles')
          .insert([role])
          .select();

        if (insertError) {
          console.log(`❌ Failed to create role '${role.name}':`, insertError.message);
          errorCount++;
        } else {
          console.log(`✅ Created role: ${role.name} (${role.display_name})`);
          createdCount++;
        }
      } else if (existing) {
        console.log(`✓  Role '${role.name}' already exists (ID: ${existing.id})`);
        existingCount++;
      } else if (checkError) {
        console.log(`❌ Error checking role '${role.name}':`, checkError.message);
        errorCount++;
      }
    } catch (err) {
      console.error(`❌ Exception for role '${role.name}':`, err.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`✅ Created: ${createdCount}`);
  console.log(`✓  Already existed: ${existingCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(50));

  if (errorCount === 0) {
    console.log('\n🎉 All roles are ready!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Completed with errors. Please check the logs above.');
    process.exit(1);
  }
}

// Run
ensureRolesExist();
