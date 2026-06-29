const allowedOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const configured = (process.env.CORS_ORIGINS || '').trim();
  if (!configured || configured === '*') {
    // Allow all origins only when explicitly set (dev/staging)
    return callback(null, true);
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Business-ID']
  },

  timeout: parseInt(process.env.SERVER_TIMEOUT || '30000', 10)
};
