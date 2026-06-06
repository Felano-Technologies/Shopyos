'use strict';

/**
 * tests/integration/auth.integration.test.js
 *
 * Integration tests for /api/v1/auth endpoints.
 *
 * Requires a real Postgres DB (DATABASE_URL env var).
 * In CI, a postgres:16 service container provides this.
 * RabbitMQ, Redis, nodemailer are mocked to keep tests isolated.
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

const request = require('supertest');
const app = require('../../server');

// Unique suffix per test run to avoid email conflicts across parallel runs
const RUN_ID = Date.now();

function uniqueEmail() {
  return `ci-test-${RUN_ID}-${Math.random().toString(36).slice(2)}@shopyos.test`;
}

// ── Register ─────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  test('registers a new user and returns 201 with a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: 'TestPassword1!',
      name: 'CI Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.message).toMatch(/created/i);
  });

  test('returns 400 when registering a duplicate email', async () => {
    const email = uniqueEmail();

    // First registration
    await request(app).post('/api/v1/auth/register').send({
      email,
      password: 'TestPassword1!',
      name: 'First User',
    });

    // Duplicate registration
    const res = await request(app).post('/api/v1/auth/register').send({
      email,
      password: 'AnotherPass1!',
      name: 'Second User',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('returns 422 when email is invalid', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'TestPassword1!',
      name: 'Bad Email User',
    });
    expect(res.status).toBe(422);
  });

  test('returns 422 when password is too short', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: 'short',
      name: 'Weak Pass User',
    });
    expect(res.status).toBe(422);
  });

  test('returns 422 when name is missing', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: 'TestPassword1!',
    });
    expect(res.status).toBe(422);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  const loginEmail = uniqueEmail();
  const loginPassword = 'LoginPassword1!';

  // Seed: register the user before the login tests run
  beforeAll(async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: loginEmail,
      password: loginPassword,
      name: 'Login Test User',
    });
  });

  test('returns 200 with token on valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: loginEmail,
      password: loginPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.message).toMatch(/success/i);
  });

  test('returns 400 on wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: loginEmail,
      password: 'wrong-password',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('returns 400 for non-existent email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@shopyos.test',
      password: 'AnyPassword1!',
    });
    expect(res.status).toBe(400);
  });

  test('returns 422 for missing email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      password: loginPassword,
    });
    expect(res.status).toBe(422);
  });
});

// ── GET /me (protected) ───────────────────────────────────────────────────────
describe('GET /api/v1/auth/me', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  test('returns 200 with valid token from a fresh registration', async () => {
    // Register and capture the token
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: 'TestPassword1!',
      name: 'Me Test User',
    });

    expect(regRes.status).toBe(201);
    const { token } = regRes.body;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBeDefined();
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/logout', () => {
  test('returns 200 regardless of whether a token is provided', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 200 and clears session with a valid token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      email: uniqueEmail(),
      password: 'TestPassword1!',
      name: 'Logout User',
    });
    const { token } = regRes.body;

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
