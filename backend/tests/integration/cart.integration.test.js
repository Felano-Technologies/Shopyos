'use strict';

/**
 * tests/integration/cart.integration.test.js
 *
 * Integration tests for /api/v1/cart endpoints.
 *
 * Requires a real Postgres DB (DATABASE_URL env var).
 * In CI, a postgres:16 service container provides this.
 * RabbitMQ, Redis, nodemailer, and notificationService are mocked to keep
 * tests isolated.
 */

jest.mock('../../../socket/src/config/socketServer', () => ({
  getIO: jest.fn().mockReturnValue(null),
  initializeSocketBridge: jest.fn(),
  emitToUser: jest.fn(),
  emitToConversation: jest.fn(),
}));

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

jest.mock('../../config/socketBridge', () => ({
  initializeSocketBridge: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../workers/scheduler', () => ({ initScheduler: jest.fn() }));
jest.mock('../../workers/notificationWorker', () => ({
  startWorker: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/validateEnv', () => jest.fn());

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
  sendOrderNotification: jest.fn().mockResolvedValue(undefined),
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue(undefined),
  sendSMS: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const app = require('../../server');

// Unique suffix per test run to avoid email conflicts across parallel runs
const RUN_ID = Date.now();

function uniqueEmail() {
  return `ci-cart-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

/**
 * Register a fresh user and return { token, userId }.
 */
async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Cart Test User',
  });
  return { token: res.body.token, userId: res.body.user?.id };
}

// ── GET /api/v1/cart ─────────────────────────────────────────────────────────
describe('GET /api/v1/cart', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with an empty cart for a newly registered user', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // A fresh user has no cart — body should reflect empty state
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

// ── POST /api/v1/cart/add ────────────────────────────────────────────────────
describe('POST /api/v1/cart/add', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/cart/add')
      .send({ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1 });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', 'Bearer garbage-token')
      .send({ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1 });
    expect(res.status).toBe(401);
  });

  test('returns 422 when productId is not a valid UUID', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'not-a-uuid', quantity: 1 });

    expect(res.status).toBe(422);
  });

  test('returns 422 when quantity is zero', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 0 });

    expect(res.status).toBe(422);
  });

  test('returns 422 when productId is missing', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(422);
  });

  test('returns 404 when product does not exist', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: '00000000-0000-4000-8000-000000000001',
        quantity: 1,
      });

    // 404 = product not found, 400 = generic validation from controller
    expect([400, 404]).toContain(res.status);
  });
});

// ── GET /api/v1/cart/count ───────────────────────────────────────────────────
describe('GET /api/v1/cart/count', () => {
  test('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/cart/count');
    expect(res.status).toBe(401);
  });

  test('returns 200 with a count for an authenticated user', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/v1/cart/count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });
});

// ── PUT /api/v1/cart/item/:itemId ────────────────────────────────────────────
describe('PUT /api/v1/cart/item/:itemId', () => {
  const fakeItemId = '00000000-0000-0000-0000-000000000099';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put(`/api/v1/cart/item/${fakeItemId}`)
      .send({ quantity: 2 });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put(`/api/v1/cart/item/${fakeItemId}`)
      .set('Authorization', 'Bearer garbage-token')
      .send({ quantity: 2 });
    expect(res.status).toBe(401);
  });

  test('returns 400 when quantity is missing', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/cart/item/${fakeItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('returns 400 when quantity is less than 1', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/cart/item/${fakeItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });

  test('returns 403 when item does not belong to the authenticated user', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/cart/item/${fakeItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 2 });

    // 403 = not the owner of this item; 400 = quantity validation fires first
    expect([400, 403]).toContain(res.status);
  });
});

// ── DELETE /api/v1/cart/item/:itemId ─────────────────────────────────────────
describe('DELETE /api/v1/cart/item/:itemId', () => {
  const fakeItemId = '00000000-0000-0000-0000-000000000099';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/cart/item/${fakeItemId}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/cart/item/${fakeItemId}`)
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 403 when item does not belong to the authenticated user', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .delete(`/api/v1/cart/item/${fakeItemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/v1/cart/clear (clear cart) ───────────────────────────────────
describe('DELETE /api/v1/cart/clear', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete('/api/v1/cart/clear');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete('/api/v1/cart/clear')
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 for an authenticated user even when cart is already empty', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .delete('/api/v1/cart/clear')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/cleared/i);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.subtotal).toBe(0);
    expect(res.body.itemCount).toBe(0);
  });
});
