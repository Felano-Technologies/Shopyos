const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
  console.log('Adding paystack_reference column...');
  // Note: Supabase JS client doesn't support ALTER TABLE directly through RPC or standard methods easily without a database function.
  // But let's check if we can use a raw query if available or just inform the user.
  // Actually, we can try to just select it to confirm it fails, and then we know we MUST alert the user.
  const { error } = await supabase.from('banner_campaigns').select('paystack_reference').limit(1);
  if (error) {
    console.log('Column missing:', error.message);
  } else {
    console.log('Column exists!');
  }
}

addColumn();
