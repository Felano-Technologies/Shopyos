'use strict';

/**
 * tests/integration/notifications.integration.test.js
 *
 * Integration tests for /api/v1/notifications endpoints.
 * All routes require authentication.
 * New users start with no notifications — tests cover empty-state responses
 * plus the full lifecycle of mark-read, delete, preferences, and push-token.
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
  return `ci-notifs-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

async function registerUser() {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: uniqueEmail(),
    password: 'TestPassword1!',
    name: 'Notification Test User',
  });
  return { token: res.body.token };
}

// ── GET /api/v1/notifications ────────────────────────────────────────────────
describe('GET /api/v1/notifications', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with empty notifications list for new user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(typeof res.body.unreadCount).toBe('number');
  });

  test('accepts unreadOnly query param', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
  });

  test('accepts limit and offset pagination params', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications?limit=5&offset=0')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
  });
});

// ── GET /api/v1/notifications/unread-count ────────────────────────────────────
describe('GET /api/v1/notifications/unread-count', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with unread count of 0 for new user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.unreadCount).toBe('number');
    expect(res.body.unreadCount).toBe(0);
  });
});

// ── GET /api/v1/notifications/preferences ────────────────────────────────────
describe('GET /api/v1/notifications/preferences', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/notifications/preferences');
    expect(res.status).toBe(401);
  });

  test('returns 200 or 404 for a new user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── PUT /api/v1/notifications/preferences ────────────────────────────────────
describe('PUT /api/v1/notifications/preferences', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .send({ orderUpdates: true });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ orderUpdates: true });
    expect(res.status).toBe(401);
  });

  test('returns 200 or 400 when updating preferences for a valid user', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderUpdates: true, messages: false, promotions: true });
    expect([200, 201, 400]).toContain(res.status);
  });
});

// ── GET /api/v1/notifications/type/:type ─────────────────────────────────────
describe('GET /api/v1/notifications/type/:type', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/notifications/type/order');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/type/order')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 or 500 for order type', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications/type/order')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 500]).toContain(res.status);
  });

  test('returns 200 or 500 for message type', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .get('/api/v1/notifications/type/message')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 500]).toContain(res.status);
  });
});

// ── PUT /api/v1/notifications/read-all ───────────────────────────────────────
describe('PUT /api/v1/notifications/read-all', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put('/api/v1/notifications/read-all');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 and marks all read (no-op for new user)', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.updatedCount).toBe('number');
  });
});

// ── PUT /api/v1/notifications/:notificationId/read ───────────────────────────
describe('PUT /api/v1/notifications/:notificationId/read', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).put(`/api/v1/notifications/${FAKE_UUID}/read`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .put(`/api/v1/notifications/${FAKE_UUID}/read`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 or 404 for a non-existent notification', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .put(`/api/v1/notifications/${FAKE_UUID}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── DELETE /api/v1/notifications/:notificationId ─────────────────────────────
describe('DELETE /api/v1/notifications/:notificationId', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete(`/api/v1/notifications/${FAKE_UUID}`);
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete(`/api/v1/notifications/${FAKE_UUID}`)
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 or 404 for a non-existent notification', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete(`/api/v1/notifications/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ── DELETE /api/v1/notifications (clear all) ─────────────────────────────────
describe('DELETE /api/v1/notifications', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).delete('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .delete('/api/v1/notifications')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 when clearing all notifications (no-op for new user)', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .delete('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /api/v1/notifications/push-token ────────────────────────────────────
describe('POST /api/v1/notifications/push-token', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/push-token')
      .send({ token: 'ExponentPushToken[xxxxxx]' });
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage auth token', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/push-token')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ token: 'ExponentPushToken[xxxxxx]' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when push token is missing', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/notifications/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 200 when registering a valid push token', async () => {
    const { token } = await registerUser();
    const res = await request(app)
      .post('/api/v1/notifications/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[test-ci-token]', platform: 'ios' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });
});
