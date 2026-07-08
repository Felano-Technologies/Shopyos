const Redis = require('ioredis');
const logger = require('./logger');

let pubClient = null;
let subClient = null;

const getPubClient = () => {
  if (pubClient) return pubClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  pubClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
  });

  pubClient.on('connect', () => logger.info('Socket Redis pub connected'));
  pubClient.on('error', (error) => logger.error('Socket Redis pub error', { error: error.message }));
  return pubClient;
};

const getSubClient = () => {
  if (subClient) return subClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  subClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
  });

  subClient.on('connect', () => logger.info('Socket Redis sub connected'));
  subClient.on('error', (error) => logger.error('Socket Redis sub error', { error: error.message }));
  return subClient;
};

// Mirror backend/config/redis.js cache format (JSON-serialized values) so
// presence keys written here stay readable by the API service.
const cacheSet = async (key, value, ttlSeconds = 300) => {
  const client = getPubClient();
  if (!client) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error('Socket Redis SET error', { key, error: error.message });
    return false;
  }
};

const cacheDel = async (key) => {
  const client = getPubClient();
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Socket Redis DEL error', { key, error: error.message });
    return false;
  }
};

module.exports = { getPubClient, getSubClient, cacheSet, cacheDel };
