const validateEnv = () => {
  const required = [
    'PORT', 'JWT_SECRET',
    'DATABASE_URL',
    'STORAGE_ENDPOINT', 'STORAGE_REGION', 'STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY', 'STORAGE_PUBLIC_URL',
    'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM', 'EMAIL_FROM_NAME',
    'ARKESEL_API_KEY', 'ARKESEL_SENDER_ID', 'PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY', 'FRONTEND_URL'
  ];

  const optional = [
    { key: 'REDIS_URL', warning: 'Redis caching will be disabled — all requests will hit the database directly' },
    { key: 'LOG_LEVEL', warning: 'Defaulting to "info" in production, "debug" in development' },
    { key: 'CORS_ORIGINS', warning: 'CORS will allow all origins (origin: "*") — not recommended for production' }
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  if (!/^postgres(ql)?:\/\/.+/.test(process.env.DATABASE_URL || '')) { console.error('DATABASE_URL must be a valid postgres URL'); process.exit(1); }
  if (!/^https?:\/\/.+/.test(process.env.FRONTEND_URL)) { console.error('FRONTEND_URL must be a valid URL'); process.exit(1); }
  if (!/^https?:\/\/.+/.test(process.env.STORAGE_ENDPOINT)) { console.error('STORAGE_ENDPOINT must be a valid URL'); process.exit(1); }
  if (!/^https?:\/\/.+/.test(process.env.STORAGE_PUBLIC_URL)) { console.error('STORAGE_PUBLIC_URL must be a valid URL'); process.exit(1); }
  if (process.env.JWT_SECRET.length < 32) { console.warn('WARNING: JWT_SECRET should be at least 32 characters'); }

  optional.forEach(({ key, warning }) => {
    if (!process.env[key]) console.warn(`${key} not set — ${warning}`);
  });

  console.log('Environment validation passed');
};

module.exports = validateEnv;
