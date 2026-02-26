module.exports = {
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : '*',
    credentials: !!process.env.CORS_ORIGINS,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  },

  timeout: 30000
};
