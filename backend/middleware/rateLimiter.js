const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');
const { logger } = require('../config/logger');

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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
  store: createStore('api'),
  message: rateLimitError('Too many requests from this IP, please try again later'),
  skip: (req) => req.path === '/health'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  store: createStore('auth'),
  message: rateLimitError('Too many login attempts, please try again later'),
  skipSuccessfulRequests: true
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  store: createStore('upload'),
  message: rateLimitError('Too many uploads, please try again later')
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  store: createStore('order'),
  message: rateLimitError('Too many orders, please try again later')
});

const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  store: createStore('msg'),
  message: rateLimitError('Too many messages, please slow down')
});

module.exports = { apiLimiter, authLimiter, uploadLimiter, orderLimiter, messageLimiter };
