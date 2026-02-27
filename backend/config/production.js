module.exports = {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const configured = process.env.CORS_ORIGINS || '*';
      if (configured === '*') return callback(null, true);
      const allowed = configured.split(',').map(o => o.trim());
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  },

  timeout: 30000
};
