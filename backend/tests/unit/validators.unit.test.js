'use strict';

/**
 * tests/unit/validators.unit.test.js
 *
 * Unit tests for express-validator middleware chains.
 * Uses a minimal Express app per test so the validator chains run end-to-end.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  cacheDel: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  httpLogMiddleware: (req, res, next) => next(),
}));

const {
  validateRegister,
  validateLogin,
  validateCreateProduct,
  validateSearch,
  validateAddToCart,
} = require('../../middleware/validators');

/** Build a minimal Express app that runs the given validator chain,
 *  then responds 200 on success or 422 with the validation errors on failure. */
function buildApp(validators, method = 'post') {
  const app = express();
  app.use(express.json());
  app[method]('/test', ...validators, (req, res) => {
    res.status(200).json({ ok: true });
  });
  // The validateRequest middleware sends 422 itself, so we just need an error fallback
  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

// ── validateRegister ─────────────────────────────────────────────────────────
describe('validateRegister', () => {
  const app = buildApp(validateRegister);

  test('passes with valid data', async () => {
    const res = await request(app).post('/test').send({
      email: 'user@example.com',
      password: 'securepassword',
      name: 'Test User',
    });
    expect(res.status).toBe(200);
  });

  test('rejects missing email', async () => {
    const res = await request(app).post('/test').send({
      password: 'securepassword',
      name: 'Test User',
    });
    expect(res.status).toBe(422);
  });

  test('rejects invalid email format', async () => {
    const res = await request(app).post('/test').send({
      email: 'not-an-email',
      password: 'securepassword',
      name: 'Test User',
    });
    expect(res.status).toBe(422);
  });

  test('rejects password shorter than 8 characters', async () => {
    const res = await request(app).post('/test').send({
      email: 'user@example.com',
      password: 'short',
      name: 'Test User',
    });
    expect(res.status).toBe(422);
  });

  test('rejects missing name', async () => {
    const res = await request(app).post('/test').send({
      email: 'user@example.com',
      password: 'securepassword',
    });
    expect(res.status).toBe(422);
  });

  test('rejects empty name', async () => {
    const res = await request(app).post('/test').send({
      email: 'user@example.com',
      password: 'securepassword',
      name: '  ',
    });
    expect(res.status).toBe(422);
  });
});

// ── validateLogin ────────────────────────────────────────────────────────────
describe('validateLogin', () => {
  const app = buildApp(validateLogin);

  test('passes with valid credentials', async () => {
    const res = await request(app).post('/test').send({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(res.status).toBe(200);
  });

  test('rejects missing email', async () => {
    const res = await request(app).post('/test').send({ password: 'pass' });
    expect(res.status).toBe(422);
  });

  test('rejects invalid email', async () => {
    const res = await request(app).post('/test').send({
      email: 'bad-email',
      password: 'pass',
    });
    expect(res.status).toBe(422);
  });

  test('rejects missing password', async () => {
    const res = await request(app).post('/test').send({ email: 'user@example.com' });
    expect(res.status).toBe(422);
  });

  test('rejects empty password', async () => {
    const res = await request(app).post('/test').send({
      email: 'user@example.com',
      password: '',
    });
    expect(res.status).toBe(422);
  });
});

// ── validateSearch ────────────────────────────────────────────────────────────
describe('validateSearch', () => {
  const app = buildApp(validateSearch, 'get');

  test('passes with no query params', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });

  test('passes with valid limit and offset', async () => {
    const res = await request(app).get('/test?limit=10&offset=0');
    expect(res.status).toBe(200);
  });

  test('rejects limit > 100', async () => {
    const res = await request(app).get('/test?limit=200');
    expect(res.status).toBe(422);
  });

  test('rejects negative offset', async () => {
    const res = await request(app).get('/test?offset=-1');
    expect(res.status).toBe(422);
  });

  test('rejects non-numeric limit', async () => {
    const res = await request(app).get('/test?limit=abc');
    expect(res.status).toBe(422);
  });

  test('passes with valid price range', async () => {
    const res = await request(app).get('/test?minPrice=5.00&maxPrice=100.00');
    expect(res.status).toBe(200);
  });

  test('rejects negative minPrice', async () => {
    const res = await request(app).get('/test?minPrice=-1');
    expect(res.status).toBe(422);
  });
});

// ── validateAddToCart ─────────────────────────────────────────────────────────
describe('validateAddToCart', () => {
  const app = buildApp(validateAddToCart);

  test('passes with valid UUID product ID', async () => {
    const res = await request(app).post('/test').send({
      productId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 2,
    });
    expect(res.status).toBe(200);
  });

  test('rejects invalid UUID for productId', async () => {
    const res = await request(app).post('/test').send({
      productId: 'not-a-uuid',
      quantity: 1,
    });
    expect(res.status).toBe(422);
  });

  test('rejects quantity of 0', async () => {
    const res = await request(app).post('/test').send({
      productId: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 0,
    });
    expect(res.status).toBe(422);
  });

  test('passes without quantity (it is optional)', async () => {
    const res = await request(app).post('/test').send({
      productId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(res.status).toBe(200);
  });
});
