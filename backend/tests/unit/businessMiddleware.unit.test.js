'use strict';

/**
 * tests/unit/businessMiddleware.unit.test.js
 *
 * Unit tests for requireStore middleware.
 * Mocks all repositories and logger.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  httpLogMiddleware: (req, res, next) => next(),
}));

jest.mock('../../db/repositories', () => ({
  stores: {
    findByOwnerId: jest.fn(),
  },
}));

const { requireStore } = require('../../middleware/businessMiddleware');
const repositories = require('../../db/repositories');

function mockReq(overrides = {}) {
  return {
    headers: {},
    requestId: 'test-req-id',
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('businessMiddleware Unit Tests', () => {
  describe('requireStore', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('test_requireStore_missingReqUser_returns401NotAuthorized', async () => {
      // Arrange
      const req = mockReq({ user: undefined });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_requireStore_missingUserId_returns401NotAuthorized', async () => {
      // Arrange
      const req = mockReq({ user: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_requireStore_noStoresFound_returns403StoreNotFound', async () => {
      // Arrange
      repositories.stores.findByOwnerId.mockResolvedValueOnce({ data: [] });
      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringMatching(/store not found/i) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_requireStore_nullRepositoryResult_returns403StoreNotFound', async () => {
      // Arrange
      repositories.stores.findByOwnerId.mockResolvedValueOnce(null);
      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_requireStore_validUserWithActiveStore_callsNextAndAttachesStoreToReq', async () => {
      // Arrange
      const activeStore = { id: 'store-abc', is_active: true, owner_id: 'user-123' };
      repositories.stores.findByOwnerId.mockResolvedValueOnce({ data: [activeStore] });
      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.store).toEqual(activeStore);
    });

    test('test_requireStore_xBusinessIdHeaderMatchesStore_callsNextWithCorrectStore', async () => {
      // Arrange
      const storeA = { id: 'store-aaa', is_active: true };
      const storeB = { id: 'store-bbb', is_active: true };
      repositories.stores.findByOwnerId.mockResolvedValueOnce({ data: [storeA, storeB] });
      const req = mockReq({
        user: { id: 'user-123' },
        headers: { 'x-business-id': 'store-bbb' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.store).toEqual(storeB);
    });

    test('test_requireStore_xStoreIdHeaderMatchesStore_callsNextWithCorrectStore', async () => {
      // Arrange
      const storeA = { id: 'store-aaa', is_active: true };
      const storeB = { id: 'store-bbb', is_active: true };
      repositories.stores.findByOwnerId.mockResolvedValueOnce({ data: [storeA, storeB] });
      const req = mockReq({
        user: { id: 'user-123' },
        headers: { 'x-store-id': 'store-aaa' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.store).toEqual(storeA);
    });

    test('test_requireStore_xBusinessIdHeaderNotOwnedByUser_returns403AccessDenied', async () => {
      // Arrange
      const storeA = { id: 'store-aaa', is_active: true };
      repositories.stores.findByOwnerId.mockResolvedValueOnce({ data: [storeA] });
      const req = mockReq({
        user: { id: 'user-123' },
        headers: { 'x-business-id': 'store-other' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringMatching(/access denied/i) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_requireStore_inactiveStore_returns403Inactive', async () => {
      // Arrange
      const inactiveStore = { id: 'store-xyz', is_active: false };
      repositories.stores.findByOwnerId.mockResolvedValueOnce({ data: [inactiveStore] });
      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringMatching(/inactive/i) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('test_requireStore_multipleStoresNoHeader_selectsFirstActiveStore', async () => {
      // Arrange
      const inactiveStore = { id: 'store-111', is_active: false };
      const activeStore = { id: 'store-222', is_active: true };
      repositories.stores.findByOwnerId.mockResolvedValueOnce({
        data: [inactiveStore, activeStore],
      });
      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.store).toEqual(activeStore);
    });

    test('test_requireStore_repositoryThrows_returns500ServerError', async () => {
      // Arrange
      repositories.stores.findByOwnerId.mockRejectedValueOnce(new Error('DB connection failed'));
      const req = mockReq({ user: { id: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await requireStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
