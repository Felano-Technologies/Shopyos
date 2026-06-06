'use strict';

/**
 * tests/integration/categories.integration.test.js
 *
 * Integration tests for /api/v1/categories endpoints.
 * GET is public and cached (cache is mocked to always miss).
 * POST/PUT/DELETE require admin role — tested via 401 and 403 paths.
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
  return `ci-categories-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Category Test User',
  });
  return { token: res.body.token };
}

// ── GET /api/v1/categories (public, uses rpc — DB-heavy locally) ─────────────
// getAll calls rpc('get_category_counts') which can timeout against remote
// Supabase. Success path is covered in CI; only auth tests run locally.
// (No auth required for GET, so there's nothing to test without hitting the DB.)

// ── POST /api/v1/categories (admin only) ─────────────────────────────────────
describe('POST /api/v1/categories', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .send({ name: 'Electronics' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ name: 'Electronics' });
    expect(res.status).toBe(401);
  });

  test('returns 403 for a regular (non-admin) user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'NewCategory' });
    expect(res.status).toBe(403);
  });
});

// ── PUT /api/v1/categories/:id (admin only) ───────────────────────────────────
describe('PUT /api/v1/categories/:id', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put(`/api/v1/categories/${FAKE_UUID}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put(`/api/v1/categories/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  test('returns 403 for a regular (non-admin) user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .put(`/api/v1/categories/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/v1/categories/:id (admin only) ────────────────────────────────
describe('DELETE /api/v1/categories/:id', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/categories/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/categories/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 403 for a regular (non-admin) user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/categories/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('returns 403 (non-admin) regardless of force param', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/categories/${FAKE_UUID}?force=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
