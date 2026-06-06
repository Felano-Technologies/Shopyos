'use strict';

/**
 * tests/integration/business.integration.test.js
 *
 * Integration tests for /api/v1/business endpoints.
 * All routes require authentication.
 * Tests cover auth guards, validation failures, and empty-state success
 * responses without needing pre-seeded store data.
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
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(undefined),
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

const RUN_ID = Date.now();
const FAKE_UUID = '00000000-0000-4000-8000-000000000001';

function uniqueEmail() {
  return `ci-business-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Business Test User',
  });
  return { token: res.body.token };
}

// ── POST /api/v1/business/create ─────────────────────────────────────────────
describe('POST /api/v1/business/create', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/business/create')
      .send({ businessName: 'Test Shop' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/business/create')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ businessName: 'Test Shop' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when required fields are missing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/business/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Test Shop' }); // missing description, category, address, city, country, phone
    expect(res.status).toBe(400);
  });

  test('returns 400 when businessName is missing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/business/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'A test shop',
        category: 'Electronics',
        address: '123 Main St',
        city: 'Accra',
        country: 'Ghana',
        phone: '+233201234567',
      });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/business/my-businesses ───────────────────────────────────────
describe('GET /api/v1/business/my-businesses', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/business/my-businesses');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/business/my-businesses')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty list for a new user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/business/my-businesses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });
});

// ── GET /api/v1/business/all (DB-heavy — see note in reviews file) ───────────
// The getAllBusinesses query uses complex Supabase joins that time out against
// the remote instance locally. Auth-guard tests are kept; success paths run
// in CI where Postgres is co-located.
describe('GET /api/v1/business/all', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/business/all');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/business/all')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/business/:id ─────────────────────────────────────────────────
describe('GET /api/v1/business/:id', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/v1/business/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get(`/api/v1/business/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 404 for a non-existent business ID', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get(`/api/v1/business/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/v1/business/:id ──────────────────────────────────────────────
describe('DELETE /api/v1/business/:id', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/business/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/business/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 403 or 404 for a non-existent or unowned business', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/business/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect([403, 404]).toContain(res.status);
  });
});

// ── GET /api/v1/business/:id/reviews ─────────────────────────────────────────
describe('GET /api/v1/business/:id/reviews', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/v1/business/${FAKE_UUID}/reviews`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get(`/api/v1/business/${FAKE_UUID}/reviews`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 or 404 for a non-existent business', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get(`/api/v1/business/${FAKE_UUID}/reviews`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── POST /api/v1/business/:id/follow ─────────────────────────────────────────
describe('POST /api/v1/business/:id/follow', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).post(`/api/v1/business/${FAKE_UUID}/follow`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post(`/api/v1/business/${FAKE_UUID}/follow`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 404 when following a non-existent business', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post(`/api/v1/business/${FAKE_UUID}/follow`)
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── DELETE /api/v1/business/:id/follow ───────────────────────────────────────
describe('DELETE /api/v1/business/:id/follow', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/business/${FAKE_UUID}/follow`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/business/${FAKE_UUID}/follow`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 or 400 when unfollowing a non-existent business', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/business/${FAKE_UUID}/follow`)
      .set('Authorization', `Bearer ${token}`);
    // Supabase DELETE is idempotent — returns 200 even if row doesn't exist
    expect([200, 400, 404]).toContain(res.status);
  });
});

// ── GET /api/v1/business/:storeId/delivery-settings ──────────────────────────
describe('GET /api/v1/business/:storeId/delivery-settings', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/v1/business/${FAKE_UUID}/delivery-settings`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get(`/api/v1/business/${FAKE_UUID}/delivery-settings`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 403 or 404 for a store the user does not own', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get(`/api/v1/business/${FAKE_UUID}/delivery-settings`)
      .set('Authorization', `Bearer ${token}`);
    expect([403, 404]).toContain(res.status);
  });
});
