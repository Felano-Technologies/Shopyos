'use strict';

/**
 * tests/unit/paymentMethodController.unit.test.js
 *
 * Unit tests for PaymentMethodController — no real DB, no HTTP server.
 * Mocks the paymentMethods repository.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../db/repositories', () => ({
  paymentMethods: {
    findByUserId: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    setDefault: jest.fn(),
  },
}));

const paymentMethodController = require('../../controllers/paymentMethodController');
const repositories = require('../../db/repositories');

function mockReq(overrides = {}) {
  return {
    user: { id: 'user-123' },
    body: {},
    params: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PaymentMethodController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getPaymentMethods ───────────────────────────────────────────────
  describe('getPaymentMethods', () => {
    test('test_getPaymentMethods_validUser_returnsMethodsAnd200', async () => {
      // Arrange
      const mockMethods = [
        { id: 'method-1', user_id: 'user-123', type: 'mobile_money', provider: 'mtn' },
      ];
      repositories.paymentMethods.findByUserId.mockResolvedValueOnce(mockMethods);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.getPaymentMethods(req, res, next);

      // Assert
      expect(repositories.paymentMethods.findByUserId).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockMethods });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getPaymentMethods_databaseFails_callsNextWithError', async () => {
      // Arrange
      repositories.paymentMethods.findByUserId.mockRejectedValueOnce(new Error('DB select error'));

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.getPaymentMethods(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── addPaymentMethod ────────────────────────────────────────────────
  describe('addPaymentMethod', () => {
    test('test_addPaymentMethod_validInput_createsMethodAndReturns201', async () => {
      // Arrange
      const mockMethod = { id: 'method-1', user_id: 'user-123', type: 'card', provider: 'visa', is_default: true };
      repositories.paymentMethods.create.mockResolvedValueOnce(mockMethod);

      const req = mockReq({
        body: { type: 'card', provider: 'visa', title: 'My Card', identifier: '4111', is_default: true },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.addPaymentMethod(req, res, next);

      // Assert
      expect(repositories.paymentMethods.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: 'card',
        provider: 'visa',
        title: 'My Card',
        identifier: '4111',
        is_default: true,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockMethod });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_addPaymentMethod_databaseFails_callsNextWithError', async () => {
      // Arrange
      repositories.paymentMethods.create.mockRejectedValueOnce(new Error('DB insert error'));

      const req = mockReq({ body: { type: 'card' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.addPaymentMethod(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── deletePaymentMethod ─────────────────────────────────────────────
  describe('deletePaymentMethod', () => {
    test('test_deletePaymentMethod_authorizedOwner_deletesAndReturns200', async () => {
      // Arrange
      const mockMethod = { id: 'method-1', user_id: 'user-123' };
      repositories.paymentMethods.findById.mockResolvedValueOnce(mockMethod);
      repositories.paymentMethods.delete.mockResolvedValueOnce(undefined);

      const req = mockReq({ params: { id: 'method-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.deletePaymentMethod(req, res, next);

      // Assert
      expect(repositories.paymentMethods.findById).toHaveBeenCalledWith('method-1');
      expect(repositories.paymentMethods.delete).toHaveBeenCalledWith('method-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Payment method deleted' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_deletePaymentMethod_methodNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.paymentMethods.findById.mockResolvedValueOnce(null);

      const req = mockReq({ params: { id: 'method-ghost' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.deletePaymentMethod(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payment method not found' });
      expect(repositories.paymentMethods.delete).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('test_deletePaymentMethod_notAuthorizedOwner_returns404NotFound', async () => {
      // Arrange
      const mockMethod = { id: 'method-1', user_id: 'user-different' };
      repositories.paymentMethods.findById.mockResolvedValueOnce(mockMethod);

      const req = mockReq({ params: { id: 'method-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.deletePaymentMethod(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payment method not found' });
      expect(repositories.paymentMethods.delete).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('test_deletePaymentMethod_databaseFails_callsNextWithError', async () => {
      // Arrange
      repositories.paymentMethods.findById.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ params: { id: 'method-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.deletePaymentMethod(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── setDefaultMethod ────────────────────────────────────────────────
  describe('setDefaultMethod', () => {
    test('test_setDefaultMethod_validId_setsDefaultAndReturns200', async () => {
      // Arrange
      const mockMethod = { id: 'method-1', user_id: 'user-123', is_default: true };
      repositories.paymentMethods.setDefault.mockResolvedValueOnce(mockMethod);

      const req = mockReq({ params: { id: 'method-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.setDefaultMethod(req, res, next);

      // Assert
      expect(repositories.paymentMethods.setDefault).toHaveBeenCalledWith('user-123', 'method-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockMethod });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_setDefaultMethod_databaseFails_callsNextWithError', async () => {
      // Arrange
      repositories.paymentMethods.setDefault.mockRejectedValueOnce(new Error('DB error'));

      const req = mockReq({ params: { id: 'method-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await paymentMethodController.setDefaultMethod(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
