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

module.exports = { getPubClient, getSubClient };
