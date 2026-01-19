// utils/validateEnv.js
// Environment variable validation

const validateEnv = () => {
  const required = [
    'PORT',
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'EMAIL_FROM',
    'EMAIL_FROM_NAME',
    'ARKESEL_API_KEY',
    'ARKESEL_SENDER_ID',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_PUBLIC_KEY',
    'FRONTEND_URL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }

  // Validate formats
  if (!/^https?:\/\/.+/.test(process.env.SUPABASE_URL)) {
    console.error('❌ SUPABASE_URL must be a valid URL');
    process.exit(1);
  }

  if (!/^https?:\/\/.+/.test(process.env.FRONTEND_URL)) {
    console.error('❌ FRONTEND_URL must be a valid URL');
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters for security');
  }

  console.log('✅ Environment validation passed');
};

module.exports = validateEnv;
