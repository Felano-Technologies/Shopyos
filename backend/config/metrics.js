const { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } = require('prom-client');

const register = new Registry();
register.setDefaultLabels({ app: 'shopyos' });
collectDefaultMetrics({ register });

const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
});

const { envStr } = require('./envConfig');

// Configurable histogram buckets from env (comma-separated seconds)
const defaultBuckets = '0.05,0.2,0.5,1,2,5,10,30';
const bucketStr = envStr('METRIC_DURATION_BUCKETS', defaultBuckets);
const metricBuckets = bucketStr.split(',').map(s => Number.parseFloat(s.trim())).filter(n => Number.isFinite(n) && n > 0);

const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: metricBuckets.length > 0 ? metricBuckets : [0.05, 0.2, 0.5, 1, 2, 5, 10, 30],
    registers: [register]
});

const httpActiveRequests = new Gauge({
    name: 'http_active_requests',
    help: 'Number of in-flight HTTP requests',
    registers: [register]
});

const cacheHitsTotal = new Counter({
    name: 'cache_hits_total',
    help: 'Total cache hits',
    registers: [register]
});

const cacheMissesTotal = new Counter({
    name: 'cache_misses_total',
    help: 'Total cache misses',
    registers: [register]
});

// Normalize Express route to avoid high-cardinality label values
function normalizeRoute(req) {
    if (req.route) return (req.baseUrl || '') + req.route.path;
    return req.path
        // Normalize UUIDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        // Normalize numeric IDs
        .replace(/\/\d+/g, '/:id')
        // Normalize hex strings (like order numbers)
        .replace(/\/[A-Z0-9]{6,}/g, '/:code');
}

module.exports = {
    register,
    httpRequestsTotal,
    httpRequestDuration,
    httpActiveRequests,
    cacheHitsTotal,
    cacheMissesTotal,
    normalizeRoute
};
