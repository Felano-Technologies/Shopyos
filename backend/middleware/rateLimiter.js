const rateLimit = require('express-rate-limit');
const { getRedis } = require('../config/redis');
const { logger } = require('../config/logger');

const createStore = () => {
  const redis = getRedis();
  if (!redis) return undefined;

  try {
    const RedisStore = require('rate-limit-redis');
    return new RedisStore({ sendCommand: (...args) => redis.call(...args), prefix: 'shopyos:rl:' });
  } catch (err) {
    logger.warn('rate-limit-redis unavailable, using in-memory store', { error: err.message });
    return undefined;
  }
};

const store = createStore();
const commonOpts = { standardHeaders: true, legacyHeaders: false, store };

const rateLimitError = (msg) => ({ success: false, error: msg });

const apiLimiter = rateLimit({
  ...commonOpts, windowMs: 15 * 60 * 1000, max: 300,
  message: rateLimitError('Too many requests from this IP, please try again later'),
  skip: (req) => req.path === '/health'
});

const authLimiter = rateLimit({
  ...commonOpts, windowMs: 15 * 60 * 1000, max: 10,
  message: rateLimitError('Too many login attempts, please try again later'),
  skipSuccessfulRequests: true
});

const uploadLimiter = rateLimit({
  ...commonOpts, windowMs: 60 * 60 * 1000, max: 30,
  message: rateLimitError('Too many uploads, please try again later')
});

const orderLimiter = rateLimit({
  ...commonOpts, windowMs: 60 * 60 * 1000, max: 20,
  message: rateLimitError('Too many orders, please try again later')
});

const messageLimiter = rateLimit({
  ...commonOpts, windowMs: 15 * 60 * 1000, max: 100,
  message: rateLimitError('Too many messages, please slow down')
});

module.exports = { apiLimiter, authLimiter, uploadLimiter, orderLimiter, messageLimiter };
