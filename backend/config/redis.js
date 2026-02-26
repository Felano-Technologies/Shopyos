const Redis = require('ioredis');
const { logger } = require('./logger');

let redisClient = null;
let isConnected = false;

const getRedis = () => {
    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('REDIS_URL not set — caching disabled');
        return null;
    }

    redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 10) return null;
            return Math.min(times * 200, 5000);
        },
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        keepAlive: 30000,
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
