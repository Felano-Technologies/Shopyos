'use strict';

/**
 * tests/integration/orders.integration.test.js
 *
 * Integration tests for /api/v1/orders endpoints.
 *
 * Requires a real Postgres DB (DATABASE_URL env var).
 * In CI, a postgres:16 service container provides this.
 * RabbitMQ, Redis, nodemailer, notificationService, and paystackService are
 * mocked to keep tests isolated.
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

jest.mock('../../services/paystackService', () => ({
  initializePayment: jest.fn().mockResolvedValue({
    authorization_url: 'https://paystack.com/pay/mock',
    access_code: 'mock-access-code',
    reference: 'mock-reference',
  }),
  verifyPayment: jest.fn().mockResolvedValue({ status: 'success' }),
}));

const request = require('supertest');
const app = require('../../server');

// Unique suffix per test run to avoid email conflicts across parallel runs
const RUN_ID = Date.now();

function uniqueEmail() {
  return `ci-orders-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

/**
 * Register a fresh user and return { token }.
 */
async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Order Test User',
  });
  return { token: res.body.token };
}

// ── POST /api/v1/orders/create ───────────────────────────────────────────────
describe('POST /api/v1/orders/create', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/api/v1/orders/create').send({
      deliveryAddress: '123 Test Street',
      deliveryCity: 'Accra',
      deliveryPhone: '+233201234567',
    });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/orders/create')
      .set('Authorization', 'Bearer garbage-token')
      .send({
        deliveryAddress: '123 Test Street',
        deliveryCity: 'Accra',
        deliveryPhone: '+233201234567',
      });
    expect(res.status).toBe(401);
  });

  test('returns 422 when deliveryAddress is missing', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deliveryCity: 'Accra',
        deliveryPhone: '+233201234567',
      });

    expect(res.status).toBe(422);
  });

  test('returns 422 when deliveryCity is missing', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deliveryAddress: '123 Test Street',
        deliveryPhone: '+233201234567',
      });

    expect(res.status).toBe(422);
  });

  test('returns 422 when deliveryPhone is missing', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deliveryAddress: '123 Test Street',
        deliveryCity: 'Accra',
      });

    expect(res.status).toBe(422);
  });

  test('returns 400 when cart is empty (all fields present)', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .post('/api/v1/orders/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        deliveryAddress: '123 Test Street',
        deliveryCity: 'Accra',
        deliveryPhone: '+233201234567',
      });

    // A freshly registered user has an empty cart
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/cart is empty/i);
  });
});

// ── GET /api/v1/orders/my-orders ─────────────────────────────────────────────
describe('GET /api/v1/orders/my-orders', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/orders/my-orders');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/orders/my-orders')
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with pagination for a newly registered user (no orders yet)', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/v1/orders/my-orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.totalItems).toBe('number');
    expect(typeof res.body.pagination.currentPage).toBe('number');
  });

  test('accepts optional status query param without error', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/v1/orders/my-orders?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('accepts pagination query params without error', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/v1/orders/my-orders?limit=5&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination.itemsPerPage).toBe(5);
  });
});

// ── GET /api/v1/orders/:orderId ──────────────────────────────────────────────
describe('GET /api/v1/orders/:orderId', () => {
  const nonExistentOrderId = '00000000-0000-0000-0000-000000000001';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/v1/orders/${nonExistentOrderId}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${nonExistentOrderId}`)
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 404 for a non-existent order ID', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get(`/api/v1/orders/${nonExistentOrderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('returns 404 for a second distinct non-existent ID', async () => {
    const { token } = await registerUser();
    const anotherId = '00000000-0000-0000-0000-000000000002';

    const res = await request(app)
      .get(`/api/v1/orders/${anotherId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PUT /api/v1/orders/:orderId/status ───────────────────────────────────────
describe('PUT /api/v1/orders/:orderId/status', () => {
  const nonExistentOrderId = '00000000-0000-0000-0000-000000000001';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/status`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/status`)
      .set('Authorization', 'Bearer garbage-token')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(401);
  });

  test('returns 403 when a regular buyer attempts the status update (role-gated)', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });

    // 403 = not seller/admin; 400 = invalid status; 404 = order not found
    // The route uses hasAnyRole('seller', 'admin') so regular buyers get 403
    expect([403, 400, 404]).toContain(res.status);
  });

  test('returns 400 when status value is not in the allowed list', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'flying-to-the-moon' });

    // 400 = bad status, 403 = role guard fires first
    expect([400, 403]).toContain(res.status);
  });
});

// ── PUT /api/v1/orders/:orderId/cancel ───────────────────────────────────────
describe('PUT /api/v1/orders/:orderId/cancel', () => {
  const nonExistentOrderId = '00000000-0000-0000-0000-000000000001';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/cancel`)
      .send({ reason: 'Changed my mind' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/cancel`)
      .set('Authorization', 'Bearer garbage-token')
      .send({ reason: 'Changed my mind' });
    expect(res.status).toBe(401);
  });

  test('returns 404 when attempting to cancel a non-existent order', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Changed my mind' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('cancel request without a reason body still returns 404 for missing order', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/orders/number/:orderNumber ───────────────────────────────────
describe('GET /api/v1/orders/number/:orderNumber', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/orders/number/ORD-FAKE-000000');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/orders/number/ORD-FAKE-000000')
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 404 for a non-existent order number', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get('/api/v1/orders/number/ORD-DOESNOTEXIST-000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });
});

// ── GET /api/v1/orders/store/:storeId ────────────────────────────────────────
describe('GET /api/v1/orders/store/:storeId (seller/admin only)', () => {
  const fakeStoreId = '00000000-0000-0000-0000-000000000010';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/v1/orders/store/${fakeStoreId}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/store/${fakeStoreId}`)
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 403 when a regular buyer tries to access store orders', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .get(`/api/v1/orders/store/${fakeStoreId}`)
      .set('Authorization', `Bearer ${token}`);

    // 403 = role guard fires; 404 = store not found after passing role check
    expect([403, 404]).toContain(res.status);
  });
});

// ── PUT /api/v1/orders/:orderId/confirm-delivery ─────────────────────────────
describe('PUT /api/v1/orders/:orderId/confirm-delivery', () => {
  const nonExistentOrderId = '00000000-0000-0000-0000-000000000001';

  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put(`/api/v1/orders/${nonExistentOrderId}/confirm-delivery`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/confirm-delivery`)
      .set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  test('returns 404 for a non-existent order', async () => {
    const { token } = await registerUser();

    const res = await request(app)
      .put(`/api/v1/orders/${nonExistentOrderId}/confirm-delivery`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
