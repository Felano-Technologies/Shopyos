const allowedOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const configured = (process.env.CORS_ORIGINS || '').trim();
  if (!configured || configured === '*') {
    // Wildcard must be an explicit choice ('*'); an UNSET list in production
    // fails closed instead of silently reflecting every origin with credentials.
    if (configured === '*' || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS_ORIGINS not configured'));
  }
  const allowed = configured.split(',').map(o => o.trim());
  if (allowed.includes(origin)) return callback(null, true);
  callback(new Error('Not allowed by CORS'));
};

module.exports = {
  cors: {
    origin: allowedOrigin,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Business-ID', 'X-Idempotency-Key']
  },

  timeout: parseInt(process.env.SERVER_TIMEOUT || '30000', 10)
};
