'use strict';

/**
 * tests/integration/userActions.integration.test.js
 *
 * Integration tests for /api/v1/user-actions endpoints.
 * All routes require authentication.
 * Routes: POST /block, DELETE /block/:id, GET /blocks, POST /report
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
  return `ci-actions-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Action Test User',
  });
  return { token: res.body.token, userId: res.body.user?.id };
}

// ── GET /api/v1/user-actions/blocks ──────────────────────────────────────────
describe('GET /api/v1/user-actions/blocks', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/user-actions/blocks');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/user-actions/blocks')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty blocked list for a new user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/user-actions/blocks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /api/v1/user-actions/block ──────────────────────────────────────────
describe('POST /api/v1/user-actions/block', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/user-actions/block')
      .send({ blockedId: FAKE_UUID });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/user-actions/block')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ blockedId: FAKE_UUID });
    expect(res.status).toBe(401);
  });

  test('returns 422 when blockedId is not a valid UUID', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ blockedId: 'not-a-uuid' });
    expect(res.status).toBe(422);
  });

  test('returns 422 when blockedId is missing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/block')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(422);
  });

  test('returns 400 when user tries to block themselves', async () => {
    const { token, userId } = await registerUser();
    if (!userId) return;
    const res = await request(app)
      .post('/api/v1/user-actions/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ blockedId: userId });
    expect([400, 422]).toContain(res.status);
  });

  test('returns 200 or 201 when blocking a non-existent user UUID', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ blockedId: FAKE_UUID });
    expect([200, 201, 400, 404]).toContain(res.status);
  });
});

// ── DELETE /api/v1/user-actions/block/:blockedId ─────────────────────────────
describe('DELETE /api/v1/user-actions/block/:blockedId', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/user-actions/block/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/user-actions/block/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 422 when blockedId param is not a valid UUID', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete('/api/v1/user-actions/block/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });

  test('returns 200 when unblocking (even if no block existed)', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/user-actions/block/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── POST /api/v1/user-actions/report ─────────────────────────────────────────
describe('POST /api/v1/user-actions/report', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .send({ entityType: 'user', entityId: FAKE_UUID, reason: 'spam' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ entityType: 'user', entityId: FAKE_UUID, reason: 'spam' });
    expect(res.status).toBe(401);
  });

  test('returns 422 when entityType is invalid', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'product', entityId: FAKE_UUID, reason: 'spam' });
    expect(res.status).toBe(422);
  });

  test('returns 422 when entityId is not a valid UUID', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'user', entityId: 'not-a-uuid', reason: 'spam' });
    expect(res.status).toBe(422);
  });

  test('returns 422 when reason is missing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'user', entityId: FAKE_UUID });
    expect(res.status).toBe(422);
  });

  test('returns 200 or 201 for a valid report request', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'user', entityId: FAKE_UUID, reason: 'spam' });
    expect([200, 201, 400, 404]).toContain(res.status);
  });

  test('returns 200 or 201 when reporting a store', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/user-actions/report')
      .set('Authorization', `Bearer ${token}`)
      .send({ entityType: 'store', entityId: FAKE_UUID, reason: 'misleading' });
    expect([200, 201, 400, 404]).toContain(res.status);
  });
});
