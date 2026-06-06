'use strict';

/**
 * tests/unit/validators.unit.test.js
 *
 * Unit tests for express-validator middleware chains.
 * Uses a minimal Express app per test so the validator chains run.
 * Conforms to guidelines/test.md.
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
  validateStartConversation,
} = require('../../middleware/validators');

/** Build a minimal Express app that runs the given validator chain,
 *  then responds 200 on success or 422 with the validation errors on failure. */
function buildApp(validators, method = 'post') {
  const app = express();
  app.use(express.json());
  app[method]('/test', ...validators, (req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use((err, req, res, _next) => {
    const status = err.name === 'ValidationError' ? 422 : 500;
    res.status(status).json({ error: err.message });
  });
  return app;
}

describe('validators Unit Tests', () => {
  // ── validateRegister ───────────────────────────────────────────────
  describe('validateRegister', () => {
    const app = buildApp(validateRegister);

    test('test_validateRegister_validData_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'user@example.com',
        password: 'securepassword',
        name: 'Test User',
      });
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateRegister_missingEmail_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        password: 'securepassword',
        name: 'Test User',
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateRegister_invalidEmailFormat_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'not-an-email',
        password: 'securepassword',
        name: 'Test User',
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateRegister_passwordShorterThan8_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'user@example.com',
        password: 'short',
        name: 'Test User',
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateRegister_missingName_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'user@example.com',
        password: 'securepassword',
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateRegister_emptyName_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'user@example.com',
        password: 'securepassword',
        name: '  ',
      });
      // Assert
      expect(res.status).toBe(422);
    });
  });

  // ── validateLogin ──────────────────────────────────────────────────
  describe('validateLogin', () => {
    const app = buildApp(validateLogin);

    test('test_validateLogin_validCredentials_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'user@example.com',
        password: 'anypassword',
      });
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateLogin_missingEmail_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({ password: 'pass' });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateLogin_invalidEmail_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'bad-email',
        password: 'pass',
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateLogin_missingPassword_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({ email: 'user@example.com' });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateLogin_emptyPassword_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        email: 'user@example.com',
        password: '',
      });
      // Assert
      expect(res.status).toBe(422);
    });
  });

  // ── validateSearch ─────────────────────────────────────────────────
  describe('validateSearch', () => {
    const app = buildApp(validateSearch, 'get');

    test('test_validateSearch_noQueryParams_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).get('/test');
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateSearch_validLimitAndOffset_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).get('/test?limit=10&offset=0');
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateSearch_limitGreaterThan100_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).get('/test?limit=200');
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateSearch_negativeOffset_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).get('/test?offset=-1');
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateSearch_nonNumericLimit_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).get('/test?limit=abc');
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateSearch_validPriceRange_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).get('/test?minPrice=5.00&maxPrice=100.00');
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateSearch_negativeMinPrice_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).get('/test?minPrice=-1');
      // Assert
      expect(res.status).toBe(422);
    });
  });

  // ── validateAddToCart ──────────────────────────────────────────────
  describe('validateAddToCart', () => {
    const app = buildApp(validateAddToCart);

    test('test_validateAddToCart_validProductId_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 2,
      });
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateAddToCart_invalidProductIdUUID_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        productId: 'not-a-uuid',
        quantity: 1,
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateAddToCart_quantityZero_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        productId: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 0,
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateAddToCart_missingQuantity_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        productId: '550e8400-e29b-41d4-a716-446655440000',
      });
      // Assert
      expect(res.status).toBe(200);
    });
  });

  // ── validateCreateProduct (lines 24-27: custom body check) ────────
  describe('validateCreateProduct', () => {
    const app = buildApp(validateCreateProduct);

    test('test_validateCreateProduct_withName_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        storeId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Widget',
        price: 9.99,
      });
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateCreateProduct_withTitle_passesWith200', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        storeId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Widget Title',
        price: 9.99,
      });
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateCreateProduct_missingNameAndTitle_rejectsWith422', async () => {
      // Arrange & Act — covers lines 24-27: the custom body().custom() branch
      const res = await request(app).post('/test').send({
        storeId: '550e8400-e29b-41d4-a716-446655440000',
        price: 9.99,
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateCreateProduct_missingStoreId_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        name: 'Widget',
        price: 9.99,
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateCreateProduct_invalidStoreIdUUID_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        storeId: 'not-a-uuid',
        name: 'Widget',
        price: 9.99,
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateCreateProduct_zeroPricePriceNotPositive_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({
        storeId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Widget',
        price: 0,
      });
      // Assert
      expect(res.status).toBe(422);
    });
  });

  // ── validateStartConversation (lines 62-66: custom UUID check) ────
  describe('validateStartConversation', () => {
    const app = buildApp(validateStartConversation);

    test('test_validateStartConversation_validUUID_passesWith200', async () => {
      // Arrange & Act — covers lines 62-65: UUID regex passes
      const res = await request(app).post('/test').send({
        participantId: '550e8400-e29b-41d4-a716-446655440000',
      });
      // Assert
      expect(res.status).toBe(200);
    });

    test('test_validateStartConversation_invalidUUID_rejectsWith422', async () => {
      // Arrange & Act — covers line 63-64: regex fails, Error thrown
      const res = await request(app).post('/test').send({
        participantId: 'not-a-uuid',
      });
      // Assert
      expect(res.status).toBe(422);
    });

    test('test_validateStartConversation_missingParticipantId_rejectsWith422', async () => {
      // Arrange & Act
      const res = await request(app).post('/test').send({});
      // Assert
      expect(res.status).toBe(422);
    });
  });
});
