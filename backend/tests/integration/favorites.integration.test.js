'use strict';

/**
 * tests/integration/favorites.integration.test.js
 *
 * Integration tests for /api/v1/favorites endpoints.
 * All routes require authentication.
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
  return `ci-favorites-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Favorites Test User',
  });
  return { token: res.body.token };
}

// ── GET /api/v1/favorites ────────────────────────────────────────────────────
describe('GET /api/v1/favorites', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/favorites');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/favorites')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty favorites list for a new user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.favorites)).toBe(true);
    expect(res.body.count).toBe(0);
  });
});

// ── POST /api/v1/favorites ───────────────────────────────────────────────────
describe('POST /api/v1/favorites', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/favorites')
      .send({ productId: FAKE_UUID });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/favorites')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ productId: FAKE_UUID });
    expect(res.status).toBe(401);
  });

  test('returns 400 when productId is missing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 when the product does not exist', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: FAKE_UUID });
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/favorites/check/:productId ────────────────────────────────────
describe('GET /api/v1/favorites/check/:productId', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get(`/api/v1/favorites/check/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get(`/api/v1/favorites/check/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with isFavorite: false for a non-favorited product', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get(`/api/v1/favorites/check/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isFavorite).toBe(false);
    expect(res.body.favoriteId).toBeNull();
  });
});

// ── DELETE /api/v1/favorites/:productId ──────────────────────────────────────
describe('DELETE /api/v1/favorites/:productId', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/favorites/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/favorites/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 404 when the favorite does not exist', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/favorites/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
