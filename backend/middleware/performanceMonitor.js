// middleware/performanceMonitor.js
// Phase 5 — Task 5.2 & 5.3: Performance monitoring with cache hit/miss metrics

const { logger } = require('../config/logger');

// ── In-memory counters (reset on restart — that's fine for single-instance) ──
const metrics = {
    requests: {
        total: 0,
        active: 0,           // currently in-flight
        statusCodes: {},      // { '200': 1234, '404': 56, ... }
    },
    responseTimes: {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        slowQueries: 0,       // > SLOW_THRESHOLD_MS
        buckets: {            // histogram buckets
            'under50ms': 0,
            '50to200ms': 0,
            '200to500ms': 0,
            '500to1000ms': 0,
            'over1000ms': 0
        }
    },
    cache: {
        hits: 0,
        misses: 0,
        hitsAfterWait: 0,     // stampede prevention saves
        errors: 0
    },
    startedAt: new Date().toISOString()
};

const SLOW_THRESHOLD_MS = 1000;
const MEMORY_WARN_MB = 256;     // Warn when heap exceeds this

/**
 * Express middleware — tracks response time, status codes, active connections,
 * cache hit/miss via X-Cache header, and logs slow requests.
 */
const performanceMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    metrics.requests.total++;
    metrics.requests.active++;

    // When response finishes
    const onFinish = () => {
        metrics.requests.active--;
        cleanup();

        const durationNs = Number(process.hrtime.bigint() - startTime);
        const durationMs = Math.round(durationNs / 1e6);

        // Status code tracking
        const code = String(res.statusCode);
        metrics.requests.statusCodes[code] = (metrics.requests.statusCodes[code] || 0) + 1;

        // Response time tracking
        metrics.responseTimes.count++;
        metrics.responseTimes.totalMs += durationMs;
        if (durationMs > metrics.responseTimes.maxMs) {
            metrics.responseTimes.maxMs = durationMs;
        }

        // Histogram buckets
        if (durationMs < 50) metrics.responseTimes.buckets['under50ms']++;
        else if (durationMs < 200) metrics.responseTimes.buckets['50to200ms']++;
        else if (durationMs < 500) metrics.responseTimes.buckets['200to500ms']++;
        else if (durationMs < 1000) metrics.responseTimes.buckets['500to1000ms']++;
        else metrics.responseTimes.buckets['over1000ms']++;

        // Slow query logging
        if (durationMs > SLOW_THRESHOLD_MS) {
            metrics.responseTimes.slowQueries++;
            logger.warn('Slow request detected', {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${durationMs}ms`,
                requestId: req.requestId,
                ip: req.ip
            });
        }

        // Cache hit/miss tracking from X-Cache header
        const cacheHeader = res.getHeader('X-Cache');
        if (cacheHeader === 'HIT') {
            metrics.cache.hits++;
        } else if (cacheHeader === 'MISS') {
            metrics.cache.misses++;
        } else if (cacheHeader === 'HIT_AFTER_WAIT') {
            metrics.cache.hitsAfterWait++;
        }

        // Memory warning
        const heapUsedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        if (heapUsedMB > MEMORY_WARN_MB) {
            logger.warn('High memory usage', { heapUsed: `${heapUsedMB}MB`, threshold: `${MEMORY_WARN_MB}MB` });
        }
    };

    const onClose = () => {
        metrics.requests.active--;
        cleanup();
    };

    const cleanup = () => {
        res.removeListener('finish', onFinish);
        res.removeListener('close', onClose);
    };

    res.on('finish', onFinish);
    res.on('close', onClose);

    next();
};

/**
 * Returns a snapshot of current metrics for the /health endpoint.
 */
const getMetrics = () => {
    const mem = process.memoryUsage();
    const avgMs = metrics.responseTimes.count > 0
        ? Math.round(metrics.responseTimes.totalMs / metrics.responseTimes.count)
        : 0;

    const totalCacheOps = metrics.cache.hits + metrics.cache.misses + metrics.cache.hitsAfterWait;
    const cacheHitRate = totalCacheOps > 0
        ? `${Math.round(((metrics.cache.hits + metrics.cache.hitsAfterWait) / totalCacheOps) * 100)}%`
        : 'N/A';

    return {
        uptime: Math.round(process.uptime()),
        startedAt: metrics.startedAt,
        requests: {
            total: metrics.requests.total,
            active: metrics.requests.active,
            statusCodes: { ...metrics.requests.statusCodes }
        },
        performance: {
            avgResponseMs: avgMs,
            maxResponseMs: metrics.responseTimes.maxMs,
            slowRequests: metrics.responseTimes.slowQueries,
            histogram: { ...metrics.responseTimes.buckets }
        },
        cache: {
            hits: metrics.cache.hits,
            misses: metrics.cache.misses,
            stampedesSaved: metrics.cache.hitsAfterWait,
            hitRate: cacheHitRate
        },
        memory: {
            heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
            rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
            external: `${Math.round(mem.external / 1024 / 1024)}MB`
        }
    };
};

/**
 * Increment cache error count (called from cache middleware on Redis failures).
 */
const recordCacheError = () => {
    metrics.cache.errors++;
};

module.exports = {
    performanceMiddleware,
    getMetrics,
    recordCacheError
};
