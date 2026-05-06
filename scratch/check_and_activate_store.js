require('dotenv').config({ path: './backend/.env' });
const repositories = require('../backend/db/repositories');
const { getPool } = require('../backend/config/postgres');

async function checkStore() {
  const email = 'abena.fashions@test.com';
  console.log(`Checking user: ${email}`);
  
  const user = await repositories.users.findByEmail(email);
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }
  
  console.log(`User ID: ${user.id}`);
  
  const result = await repositories.stores.findByOwnerId(user.id);
  const store = result?.data?.[0];
  
  if (!store) {
    console.log('Store not found for this user');
  } else {
    console.log('Store found:');
    console.log(`- ID: ${store.id}`);
    console.log(`- Name: ${store.store_name}`);
    console.log(`- Is Active: ${store.is_active}`);
    console.log(`- Verification Status: ${store.verification_status}`);
    
    if (!store.is_active) {
      console.log('Activating store for testing...');
      await repositories.stores.update(store.id, { is_active: true });
      console.log('Store activated successfully!');
    }
  }
  
  process.exit(0);
}

checkStore().catch(err => {
  console.error(err);
  process.exit(1);
});
