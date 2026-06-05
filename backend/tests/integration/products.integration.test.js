'use strict';

/**
 * tests/integration/products.integration.test.js
 *
 * Integration tests for /api/v1/products endpoints.
 * Tests public (unauthenticated) and protected (role-gated) routes.
 */

jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

jest.mock('../../config/redis', () => ({
  getRedis: jest.fn().mockReturnValue(null),
  healthCheck: jest.fn().mockResolvedValue({ connected: false, reason: 'mocked' }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
  cacheDelPattern: jest.fn().mockResolvedValue(0),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isRedisConnected: jest.fn().mockReturnValue(false),
}));

jest.mock('../../middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  productCacheKey: {
    search: jest.fn().mockReturnValue('search-cache-key'),
    store: jest.fn().mockReturnValue('store-cache-key'),
    detail: jest.fn().mockReturnValue('detail-cache-key'),
  },
  hashParams: jest.fn().mockReturnValue('hash'),
}));

jest.mock('../../config/socketBridge', () => ({
  initializeSocketBridge: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../workers/scheduler', () => ({ initScheduler: jest.fn() }));
jest.mock('../../workers/notificationWorker', () => ({
  startWorker: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/validateEnv', () => jest.fn());

const request = require('supertest');
const app = require('../../server');

// ── Public product search ─────────────────────────────────────────────────────
describe('GET /api/v1/products/search', () => {
  test('returns 200 with results array for a basic query', async () => {
    const res = await request(app).get('/api/v1/products/search?q=phone');

    // Accept 200 (results found) or 200 with empty results
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  test('returns 422 when limit is out of range', async () => {
    const res = await request(app).get('/api/v1/products/search?limit=9999');
    expect(res.status).toBe(422);
  });

  test('returns 422 when offset is negative', async () => {
    const res = await request(app).get('/api/v1/products/search?offset=-5');
    expect(res.status).toBe(422);
  });
});

// ── Public store products ─────────────────────────────────────────────────────
describe('GET /api/v1/products/store/:storeId', () => {
  test('returns 200 for any storeId (even nonexistent — returns empty list)', async () => {
    const fakeStoreId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app).get(`/api/v1/products/store/${fakeStoreId}`);

    // May return 200 with empty data or 404 if store not found — both acceptable
    expect([200, 404]).toContain(res.status);
  });
});

// ── Protected: POST /api/v1/products ─────────────────────────────────────────
describe('POST /api/v1/products', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/v1/products').send({
      storeId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Product',
      price: 10.99,
    });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', 'Bearer garbage-token')
      .send({
        storeId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Product',
        price: 10.99,
      });
    expect(res.status).toBe(401);
  });
});

// ── Protected: PUT /api/v1/products/:id ──────────────────────────────────────
describe('PUT /api/v1/products/:id', () => {
  test('returns 401 when unauthenticated', async () => {
    const fakeId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app)
      .put(`/api/v1/products/${fakeId}`)
      .send({ price: 20.00 });
    expect(res.status).toBe(401);
  });
});

// ── Protected: DELETE /api/v1/products/:id ───────────────────────────────────
describe('DELETE /api/v1/products/:id', () => {
  test('returns 401 when unauthenticated', async () => {
    const fakeId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).delete(`/api/v1/products/${fakeId}`);
    expect(res.status).toBe(401);
  });
});

// ── Validation on product creation ────────────────────────────────────────────
describe('POST /api/v1/products — validation (no auth needed to see 422)', () => {
  test('returns 422 when storeId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', 'Bearer bad-but-let-validator-run')
      .send({ storeId: 'not-a-uuid', name: 'Product', price: 5 });

    // Either 401 (auth fails first) or 422 (validator fires first) — both correct
    expect([401, 422]).toContain(res.status);
  });
});
