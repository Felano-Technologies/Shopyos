const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');
const { logger } = require('../config/logger');
const { envInt } = require('../config/envConfig');

// Each limiter needs its own store instance with a unique prefix
const createStore = (prefix) => {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    const { default: RedisStore } = require('rate-limit-redis');
    return new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: `shopyos:rl:${prefix}:` });
  } catch (err) {
    logger.warn('rate-limit-redis unavailable, using in-memory store', { error: err.message });
    return undefined;
  }
};

const rateLimitError = (msg) => ({ success: false, error: msg });

const isDev = process.env.NODE_ENV !== 'production';

// Skip rate limiting in test/dev environments — configurable via DISABLE_RATE_LIMIT
const shouldSkip = process.env.DISABLE_RATE_LIMIT === 'true' || isDev;

const apiLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_API_WINDOW_MS', 15 * 60 * 1000),
  max: envInt('RATE_LIMIT_API_MAX', 300),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('api'),
  message: rateLimitError('Too many requests from this IP, please try again later'),
  skip: (req) => shouldSkip || req.path === '/health'
});

const authLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
  max: envInt('RATE_LIMIT_AUTH_MAX', 10),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('auth'),
  message: rateLimitError('Too many login attempts, please try again later'),
  skip: (_req) => shouldSkip,
  skipSuccessfulRequests: true
});

const uploadLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_UPLOAD_WINDOW_MS', 60 * 60 * 1000),
  max: envInt('RATE_LIMIT_UPLOAD_MAX', 30),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('upload'),
  message: rateLimitError('Too many uploads, please try again later'),
  skip: (_req) => shouldSkip
});

const orderLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_ORDER_WINDOW_MS', 60 * 60 * 1000),
  max: envInt('RATE_LIMIT_ORDER_MAX', 20),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('order'),
  message: rateLimitError('Too many orders, please try again later'),
  skip: (_req) => shouldSkip
});

const messageLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_MSG_WINDOW_MS', 15 * 60 * 1000),
  max: envInt('RATE_LIMIT_MSG_MAX', 100),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('msg'),
  message: rateLimitError('Too many messages, please slow down'),
  skip: (_req) => shouldSkip
});

const paymentLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_PAYMENT_WINDOW_MS', 60 * 60 * 1000),
  max: envInt('RATE_LIMIT_PAYMENT_MAX', 20),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('payment'),
  message: rateLimitError('Too many payment requests, please try again later'),
  skip: (_req) => shouldSkip
});

// New limiters for previously un-protected endpoints
const authRefreshLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_REFRESH_WINDOW_MS', 15 * 60 * 1000),
  max: envInt('RATE_LIMIT_REFRESH_MAX', 20),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('refresh'),
  message: rateLimitError('Too many refresh attempts, please try again later'),
  skip: (_req) => shouldSkip
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  store: createStore('webhook'),
  message: rateLimitError('Too many webhook requests'),
  skip: (_req) => shouldSkip
});

const productCreateLimiter = rateLimit({
  windowMs: envInt('RATE_LIMIT_PRODUCT_CREATE_WINDOW_MS', 60 * 60 * 1000),
  max: envInt('RATE_LIMIT_PRODUCT_CREATE_MAX', 30),
  standardHeaders: true, legacyHeaders: false,
  store: createStore('product-create'),
  message: rateLimitError('Too many product creation requests'),
  skip: (_req) => shouldSkip
});

const cartLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  store: createStore('cart'),
  message: rateLimitError('Too many cart operations'),
  skip: (_req) => shouldSkip
});

module.exports = {
  apiLimiter, authLimiter, uploadLimiter, orderLimiter, messageLimiter, paymentLimiter,
  authRefreshLimiter, webhookLimiter, productCreateLimiter, cartLimiter
};
