// config/supabase.js
// Supabase client configuration for PostgreSQL database access

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Server-side only
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required in .env file');
}

if (!supabaseServiceKey) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not found - some admin operations may fail');
}

/**
 * Supabase client with service role key (server-side only)
 * Has full database access, bypassing RLS policies
 * Use for: Admin operations, server-side logic, data migrations
 */
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

/**
 * Supabase client with anon key (respects RLS)
 * Use for: User-facing operations with RLS policies
 */
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
    return false;
  }
};

/**
 * Execute SQL query with parameters (protection against SQL injection)
 * @param {string} query - SQL query with $1, $2, etc. placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - { data, error }
 */
const executeQuery = async (query, params = []) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      query_text: query,
      query_params: params
    });
    
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
};

/**
 * Begin a database transaction
 * @returns {Promise<Object>} - Transaction client
 */
const beginTransaction = async () => {
  // Supabase doesn't directly expose transactions in JS client
  // We'll use PostgreSQL function for critical operations
  return supabaseAdmin;
};

/**
 * Execute operations within a transaction
 * @param {Function} operations - Async function containing database operations
 * @returns {Promise<Object>} - { success, data, error }
 */
const withTransaction = async (operations) => {
  try {
    // For complex transactions, use stored procedures
    // This is a simplified wrapper
    const result = await operations(supabaseAdmin);
    return { success: true, data: result, error: null };
  } catch (error) {
    console.error('Transaction failed:', error);
    return { success: false, data: null, error };
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  testConnection,
  executeQuery,
  beginTransaction,
  withTransaction
};
