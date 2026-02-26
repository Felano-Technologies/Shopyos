const crypto = require('crypto');
const { cacheGet, cacheSet, acquireLock, releaseLock } = require('../config/redis');
const { logger } = require('../config/logger');

const hashParams = (params) => {
    const sorted = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('md5').update(sorted).digest('hex').substring(0, 12);
};

// Express middleware: check Redis before hitting the controller.
// On miss, intercepts res.json() to cache the response.
const cacheMiddleware = (keyGenerator, ttlSeconds = 300) => {
    return async (req, res, next) => {
        const cacheKey = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;
        if (!cacheKey) return next();

        try {
            const cached = await cacheGet(cacheKey);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                return res.status(200).json(cached);
            }
        } catch {
            // Cache down — fall through to DB
        }

        res.setHeader('X-Cache', 'MISS');

        // Stampede prevention: only one request fetches from DB when cache is cold
        const lockKey = `shopyos:lock:${cacheKey}`;
        const gotLock = await acquireLock(lockKey, 10);

        if (!gotLock) {
            // Another request is populating the cache — wait and retry
            for (let i = 0; i < 3; i++) {
                await new Promise(r => setTimeout(r, 100));
                const retryData = await cacheGet(cacheKey);
                if (retryData) {
                    res.setHeader('X-Cache', 'HIT_AFTER_WAIT');
                    return res.status(200).json(retryData);
                }
            }
        }

        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300 && body) {
                cacheSet(cacheKey, body, ttlSeconds).catch(() => { });
                releaseLock(lockKey).catch(() => { });
            }
            return originalJson(body);
        };

        next();
    };
};

const productCacheKey = {
    detail: (id) => `shopyos:products:detail:${id}`,
    store: (storeId, page, limit) => `shopyos:products:store:${storeId}:${page}:${limit}`,
    search: (params) => `shopyos:products:search:${hashParams(params)}`,
    promoted: () => 'shopyos:products:promoted'
};

const categoryCacheKey = {
    all: () => 'shopyos:categories:all'
};

const storeCacheKey = {
    detail: (id) => `shopyos:stores:detail:${id}`,
    all: (params) => `shopyos:stores:all:${hashParams(params)}`,
    featured: () => 'shopyos:stores:featured'
};

const reviewCacheKey = {
    product: (productId, page) => `shopyos:reviews:product:${productId}:${page}`,
    store: (storeId, page) => `shopyos:reviews:store:${storeId}:${page}`
};

module.exports = {
    cacheMiddleware,
    hashParams,
    productCacheKey,
    categoryCacheKey,
    storeCacheKey,
    reviewCacheKey
};
