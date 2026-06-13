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

const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.2, 0.5, 1, 2, 5],
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
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        .replace(/\/\d+/g, '/:id');
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
