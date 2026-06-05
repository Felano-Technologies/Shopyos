'use strict';

/**
 * tests/integration/health.integration.test.js
 *
 * Integration tests for core API routes that need no auth.
 * Spins up the real Express app via Supertest — requires DATABASE_URL.
 */

// Mock infrastructure that would fail in CI without real external services
jest.mock('../../services/rabbitmq');
jest.mock('nodemailer');

// Mock Redis so health checks don't need a real Redis connection
jest.mock('../../config/redis', () => ({
  getRedis: jest.fn().mockReturnValue(null),
  healthCheck: jest.fn().mockResolvedValue({ connected: false, reason: 'mocked in tests' }),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
  cacheDelPattern: jest.fn().mockResolvedValue(0),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isRedisConnected: jest.fn().mockReturnValue(false),
}));

// Mock Socket bridge so server.js doesn't try to start WebSockets
jest.mock('../../config/socketBridge', () => ({
  initializeSocketBridge: jest.fn().mockResolvedValue(null),
}));

// Mock the scheduler and notification worker
jest.mock('../../workers/scheduler', () => ({
  initScheduler: jest.fn(),
}));
jest.mock('../../workers/notificationWorker', () => ({
  startWorker: jest.fn().mockResolvedValue(undefined),
}));

// Mock validateEnv so it doesn't throw when optional vars are missing
jest.mock('../../utils/validateEnv', () => jest.fn());

const request = require('supertest');
const app = require('../../server');

// ── Root & API discovery ─────────────────────────────────────────────────────
describe('GET /', () => {
  test('returns 200 with API live message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Shopyos API');
  });
});

describe('GET /api', () => {
  test('returns 200 with API metadata', async () => {
    const res = await request(app).get('/api');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.version).toBeDefined();
  });
});

describe('GET /api/v1', () => {
  test('returns 200 with endpoint list', async () => {
    const res = await request(app).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.endpoints).toBeDefined();
    expect(res.body.endpoints.auth).toContain('/api/v1/auth');
  });
});

// ── 404 handling ─────────────────────────────────────────────────────────────
describe('GET /api/v1/nonexistent', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route-xyz');
    expect(res.status).toBe(404);
  });
});

// ── Health endpoint ───────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('returns a health object with expected shape', async () => {
    const res = await request(app).get('/health');
    // Accept 200 (healthy) or 503 (degraded — DB not available in unit mode)
    expect([200, 503]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.redis).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
  });
});
