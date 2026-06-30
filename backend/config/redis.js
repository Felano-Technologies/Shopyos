const Redis = require('ioredis');
const { logger } = require('./logger');
const { envInt } = require('./envConfig');

let redisClient = null;
let isConnected = false;

const getRedis = () => {
    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('REDIS_URL not set — caching disabled');
        return null;
    }

    const maxRetries = envInt('REDIS_MAX_RETRIES', 0); // 0 = infinite

    redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: envInt('REDIS_MAX_RETRIES_PER_REQUEST', 3),
        retryStrategy(times) {
            if (maxRetries > 0 && times > maxRetries) {
                logger.error(`Redis: Exceeded max retries (${maxRetries}), giving up`);
                return null;
            }
            // Exponential backoff with jitter: 200ms → ... → max 30s
            const delay = Math.min(times * 200, 30000);
            const jitter = Math.random() * 200;
            return delay + jitter;
        },
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: envInt('REDIS_CONNECT_TIMEOUT', 10000),
        commandTimeout: envInt('REDIS_COMMAND_TIMEOUT', 5000),
        keepAlive: envInt('REDIS_KEEPALIVE', 30000),
        reconnectOnError(err) {
            return ['READONLY', 'ECONNRESET', 'ECONNREFUSED'].some(e => err.message.includes(e));
        }
    });

    redisClient.on('connect', () => {
        isConnected = true;
        logger.info('Redis connected');
    });

    redisClient.on('ready', () => { isConnected = true; });

    redisClient.on('error', (err) => {
        isConnected = false;
        logger.error('Redis connection error', { error: err.message });
    });

    redisClient.on('close', () => { isConnected = false; });

    return redisClient;
};

const healthCheck = async () => {
    const client = getRedis();
    if (!client) return { connected: false, reason: 'REDIS_URL not configured' };

    try {
        const start = Date.now();
        await client.ping();
        return { connected: true, latency: `${Date.now() - start}ms` };
    } catch (err) {
        return { connected: false, reason: err.message };
    }
};

const cacheGet = async (key) => {
    const client = getRedis();
    if (!client || !isConnected) return null;

    try {
        const value = await client.get(key);
        return value === null ? null : JSON.parse(value);
    } catch (err) {
        logger.error('Redis GET error', { key, error: err.message });
        return null;
    }
};

const cacheSet = async (key, value, ttlSeconds = 300) => {
    const client = getRedis();
    if (!client || !isConnected) return false;

    try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds > 0) {
            await client.setex(key, ttlSeconds, serialized);
        } else {
            await client.set(key, serialized);
        }
        return true;
    } catch (err) {
        logger.error('Redis SET error', { key, error: err.message });
        return false;
    }
};

const cacheDel = async (keys) => {
    const client = getRedis();
    if (!client || !isConnected) return 0;

    try {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        if (keyArray.length === 0) return 0;
        return await client.del(...keyArray);
    } catch (err) {
        logger.error('Redis DEL error', { error: err.message });
        return 0;
    }
};

// Uses SCAN (non-blocking) instead of KEYS to safely delete by pattern in production
const cacheDelPattern = async (pattern) => {
    const client = getRedis();
    if (!client || !isConnected) return 0;

    try {
        let deleted = 0;
        let cursor = '0';

        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                const pipeline = client.pipeline();
                keys.forEach(key => pipeline.del(key));
                const results = await pipeline.exec();
                deleted += results.length;
            }
        } while (cursor !== '0');

        return deleted;
    } catch (err) {
        logger.error('Redis DEL PATTERN error', { pattern, error: err.message });
        return 0;
    }
};

// SET NX EX — fail-open if Redis is down
const acquireLock = async (lockKey, ttlSeconds = 10) => {
    const client = getRedis();
    if (!client || !isConnected) return true;

    try {
        const result = await client.set(lockKey, '1', 'NX', 'EX', ttlSeconds);
        return result === 'OK';
    } catch {
        return true;
    }
};

const releaseLock = async (lockKey) => {
    const client = getRedis();
    if (!client || !isConnected) return;

    try {
        await client.del(lockKey);
    } catch {
        // Lock will expire via TTL
    }
};

const disconnect = async () => {
    if (!redisClient) return;

    try {
        await redisClient.quit();
        logger.info('Redis disconnected');
    } catch (err) {
        logger.error('Redis disconnect error', { error: err.message });
        redisClient.disconnect();
    }
    redisClient = null;
    isConnected = false;
};

const isRedisConnected = () => isConnected;

module.exports = {
    getRedis,
    healthCheck,
    cacheGet,
    cacheSet,
    cacheDel,
    cacheDelPattern,
    acquireLock,
    releaseLock,
    disconnect,
    isRedisConnected
};
