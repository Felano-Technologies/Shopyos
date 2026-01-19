// middleware/rateLimiter.js
// Rate limiting middleware to prevent abuse

const rateLimit = require('express-rate-limit');

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful requests to health check
  skip: (req) => req.path === '/health'
});

// Strict limiter for auth endpoints - 5 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful auth attempts
});

// Upload limiter - 20 uploads per hour
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    error: 'Too many uploads, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Payment/Order limiter - 10 orders per hour
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Too many orders, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Message limiter - 50 messages per 15 minutes
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: 'Too many messages, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  orderLimiter,
  messageLimiter
};
