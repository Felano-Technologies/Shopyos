'use strict';

/**
 * tests/unit/userActionController.unit.test.js
 *
 * Unit tests for UserActionController — no real DB, no HTTP server.
 * Mocks the users repository database pool and supabase-like DB adapter.
 * Conforms to guidelines/test.md.
 */

const mockDbChain = {
  from: jest.fn(),
  insert: jest.fn(),
  delete: jest.fn(),
  match: jest.fn(),
};

const mockPool = {
  query: jest.fn(),
};

jest.mock('../../db/repositories', () => ({
  users: {
    db: mockDbChain,
    getPool: jest.fn(() => mockPool),
  },
}));

jest.mock('../../config/storage', () => ({
  toPublicUrl: jest.fn((url) => url ? `http://mocked-public-url/${url}` : null),
  resolveImageUrl: jest.fn(async (url) => url ? `http://mocked-public-url/${url}` : null),
}));

jest.mock('../../config/postgres', () => ({
  getPool: jest.fn(() => mockPool),
}));

const userActionController = require('../../controllers/userActionController');
const _repositories = require('../../db/repositories');
const _storage = require('../../config/storage');

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

describe('UserActionController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbChain.from.mockReturnValue(mockDbChain);
    mockDbChain.insert.mockReturnValue(mockDbChain);
    mockDbChain.delete.mockReturnValue(mockDbChain);
    mockDbChain.match.mockReturnValue(mockDbChain);
  });

  // ── blockUser ───────────────────────────────────────────────────────
  describe('blockUser', () => {
    test('test_blockUser_validInput_blocksUserSuccessfully', async () => {
      // Arrange
      mockDbChain.insert.mockResolvedValueOnce({ error: null });

      const req = mockReq({ body: { blockedId: 'user-456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.blockUser(req, res, next);

      // Assert
      expect(mockDbChain.from).toHaveBeenCalledWith('user_blocks');
      expect(mockDbChain.insert).toHaveBeenCalledWith({
        blocker_id: 'user-123',
        blocked_id: 'user-456',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'User blocked successfully' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_blockUser_missingBlockedId_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.blockUser(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Blocked user ID is required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_blockUser_blockSelf_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { blockedId: 'user-123' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.blockUser(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'You cannot block yourself' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_blockUser_alreadyBlocked_returns400BadRequest', async () => {
      // Arrange
      mockDbChain.insert.mockResolvedValueOnce({ error: { code: '23505' } });

      const req = mockReq({ body: { blockedId: 'user-456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.blockUser(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User is already blocked' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_blockUser_dbInsertFails_callsNextWithError', async () => {
      // Arrange
      mockDbChain.insert.mockResolvedValueOnce({ error: new Error('Insert failed') });

      const req = mockReq({ body: { blockedId: 'user-456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.blockUser(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── unblockUser ─────────────────────────────────────────────────────
  describe('unblockUser', () => {
    test('test_unblockUser_validId_unblocksSuccessfully', async () => {
      // Arrange
      mockDbChain.match.mockResolvedValueOnce({ error: null });

      const req = mockReq({ params: { blockedId: 'user-456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.unblockUser(req, res, next);

      // Assert
      expect(mockDbChain.from).toHaveBeenCalledWith('user_blocks');
      expect(mockDbChain.match).toHaveBeenCalledWith({ blocker_id: 'user-123', blocked_id: 'user-456' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'User unblocked successfully' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_unblockUser_missingParam_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ params: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.unblockUser(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Blocked user ID is required' });
    });

    test('test_unblockUser_databaseDeleteFails_callsNextWithError', async () => {
      // Arrange
      mockDbChain.match.mockResolvedValueOnce({ error: new Error('Delete failed') });

      const req = mockReq({ params: { blockedId: 'user-456' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.unblockUser(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── getBlockedUsers ─────────────────────────────────────────────────
  describe('getBlockedUsers', () => {
    test('test_getBlockedUsers_validUser_returnsBlockedList', async () => {
      // Arrange
      const mockRows = [
        {
          blocked_id: 'user-456',
          created_at: '2026-06-05',
          user_id: 'user-456',
          full_name: 'Blocked User',
          avatar_url: 'avatar.jpg',
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.getBlockedUsers(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['user-123']);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        blockedUsers: [
          {
            blocked_id: 'user-456',
            created_at: '2026-06-05',
            blocked_user: {
              id: 'user-456',
              user_profiles: {
                full_name: 'Blocked User',
                avatar_url: 'http://mocked-public-url/avatar.jpg',
              },
            },
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getBlockedUsers_queryFails_callsNextWithError', async () => {
      // Arrange
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.getBlockedUsers(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── reportEntity ────────────────────────────────────────────────────
  describe('reportEntity', () => {
    test('test_reportEntity_reportUser_submitsReportSuccessfully', async () => {
      // Arrange
      mockDbChain.insert.mockResolvedValueOnce({ error: null });

      const req = mockReq({
        body: { entityType: 'user', entityId: 'user-456', reason: 'spam', details: 'Sends too much spam' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.reportEntity(req, res, next);

      // Assert
      expect(mockDbChain.from).toHaveBeenCalledWith('user_reports');
      expect(mockDbChain.insert).toHaveBeenCalledWith({
        reporter_id: 'user-123',
        entity_type: 'user',
        reason: 'spam',
        details: 'Sends too much spam',
        reported_user_id: 'user-456',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Report submitted successfully' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_reportEntity_reportStore_submitsReportSuccessfully', async () => {
      // Arrange
      mockDbChain.insert.mockResolvedValueOnce({ error: null });

      const req = mockReq({
        body: { entityType: 'store', entityId: 'store-789', reason: 'fake_items', details: 'Fakes items' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.reportEntity(req, res, next);

      // Assert
      expect(mockDbChain.insert).toHaveBeenCalledWith({
        reporter_id: 'user-123',
        entity_type: 'store',
        reason: 'fake_items',
        details: 'Fakes items',
        reported_store_id: 'store-789',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_reportEntity_missingRequiredFields_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { entityType: 'user', reason: 'spam' } }); // missing entityId
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.reportEntity(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Entity type, entity ID, and reason are required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_reportEntity_invalidEntityType_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { entityType: 'product', entityId: 'prod-123', reason: 'broken' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.reportEntity(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid entity type' });
    });

    test('test_reportEntity_reportSelf_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({ body: { entityType: 'user', entityId: 'user-123', reason: 'self-loathing' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.reportEntity(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'You cannot report yourself' });
    });

    test('test_reportEntity_databaseInsertFails_callsNextWithError', async () => {
      // Arrange
      mockDbChain.insert.mockResolvedValueOnce({ error: new Error('Report insert failed') });

      const req = mockReq({ body: { entityType: 'user', entityId: 'user-456', reason: 'spam' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await userActionController.reportEntity(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});


