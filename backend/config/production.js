// config/production.js
// Production-specific configuration

module.exports = {
  // Database connection pooling
  supabase: {
    options: {
      db: {
        schema: 'public'
      },
      auth: {
        autoRefreshToken: true,
        persistSession: false
      },
      global: {
        headers: {
          'x-application-name': 'shopyos-backend'
        }
      }
    }
  },

  // CORS configuration
  cors: {
    origin: '*', // Allow all origins (use specific URLs in production)
    credentials: false, // Must be false when origin is '*'
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // requests per window
  },

  // Request timeout
  timeout: 30000, // 30 seconds

  // File upload limits
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5
  },

  // JWT configuration
  jwt: {
    expiresIn: '7d',
    refreshExpiresIn: '30d'
  },

  // Cloudinary optimization
  cloudinary: {
    secure: true,
    transformation: {
      quality: 'auto',
      fetch_format: 'auto'
    }
  },

  // Email configuration
  email: {
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  },

  // Logging
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    format: 'json'
  },

  // Security
  security: {
    bcryptRounds: 12,
    sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  }
};
