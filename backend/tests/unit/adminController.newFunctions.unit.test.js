'use strict';

/**
 * tests/unit/adminController.newFunctions.unit.test.js
 *
 * Unit tests for the new functions added to adminController.js (lines 837-1188):
 *   deleteUser, resetUserSession, disableUserSession, createUserProfile,
 *   createStoreAdmin, createDriverProfileAdmin, getDriverStatsAdmin, getDriverHistoryAdmin
 *
 * Mocks all external dependencies — no real DB, Redis, or service calls.
 * Follows AAA pattern and test_<function>_<condition>_<expected> naming.
 */

jest.mock('../../services/rabbitmq', () => ({ publishMessage: jest.fn() }));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── postgres pool mock ─────────────────────────────────────────────────────────
// Built inside the factory so it is available when Jest hoists jest.mock() calls.
jest.mock('../../config/postgres', () => {
  const pool = { query: jest.fn() };
  return { getPool: jest.fn(() => pool), __pool: pool };
});

// ── redis mock ────────────────────────────────────────────────────────────────
jest.mock('../../config/redis', () => ({ cacheDel: jest.fn().mockResolvedValue(1) }));

// ── repositories mock ─────────────────────────────────────────────────────────
// The db chain is defined inside the factory so it exists when hoisting runs.
// dbChain is a thenable builder: all chain methods return `this` so multiple
// .eq() calls work, and awaiting `dbChain` resolves via its `.then()` method.
jest.mock('../../db/repositories', () => {
  const dbChain = {
    from:   jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    // Make dbChain awaitable — resolves to {} by default.
    // Tests that need a rejection can replace this with a rejecting then.
    then:   jest.fn((resolve) => resolve({})),
  };
  return {
    users: {
      createUser: jest.fn(),
      db: dbChain,
    },
    userProfiles: { create: jest.fn() },
    admin: { setUserRoleByUserId: jest.fn() },
    auditLogs: { createLog: jest.fn().mockResolvedValue({}) },
  };
});

// ── notification service mock ─────────────────────────────────────────────────
jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
}));

// ── pull in mocks and the controller AFTER jest.mock calls ───────────────────
const repositories        = require('../../db/repositories');
const postgresConfig       = require('../../config/postgres');
const { cacheDel }        = require('../../config/redis');
const notificationService  = require('../../services/notificationService');

// Grab the shared pool object that the factory created.
const mockPool    = postgresConfig.__pool;
// Grab the shared db chain that the factory created.
const mockDbChain = repositories.users.db;

const {
  deleteUser,
  resetUserSession,
  disableUserSession,
  createUserProfile,
  createStoreAdmin,
  createDriverProfileAdmin,
  getDriverStatsAdmin,
  getDriverHistoryAdmin,
} = require('../../controllers/adminController');

// ── helpers ───────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params:  {},
    query:   {},
    body:    {},
    user:    { id: 'admin-user-id' },
    ip:      '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminController – new functions unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore the db chain's default chainable + awaitable behaviour.
    mockDbChain.from.mockReturnThis();
    mockDbChain.update.mockReturnThis();
    mockDbChain.eq.mockReturnThis();
    mockDbChain.then.mockImplementation((resolve) => resolve({}));
  });

  // ── deleteUser ──────────────────────────────────────────────────────────────
  describe('deleteUser', () => {
    test('test_deleteUser_happyPath_softDeletesRevokesTokensBustsCacheReturns200', async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const req = mockReq({ params: { userId: 'user-abc' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteUser(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET is_active = FALSE'),
        ['user-abc']
      );
      expect(mockDbChain.from).toHaveBeenCalledWith('refresh_tokens');
      expect(mockDbChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_revoked: true, revoked_reason: 'admin_deleted' })
      );
      expect(cacheDel).toHaveBeenCalledWith('shopyos:users:user-abc:auth');
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete_user', entityId: 'user-abc' })
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    test('test_deleteUser_dbQueryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('DB write failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { userId: 'user-abc' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await deleteUser(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── resetUserSession ────────────────────────────────────────────────────────
  describe('resetUserSession', () => {
    test('test_resetUserSession_happyPath_revokesTokensDeletesCacheReturns200', async () => {
      // Arrange
      const req = mockReq({ params: { userId: 'user-def' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await resetUserSession(req, res, next);

      // Assert
      expect(mockDbChain.from).toHaveBeenCalledWith('refresh_tokens');
      expect(mockDbChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_revoked: true, revoked_reason: 'admin_reset' })
      );
      expect(cacheDel).toHaveBeenCalledWith('shopyos:users:user-def:auth');
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reset_user_session', entityId: 'user-def' })
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    test('test_resetUserSession_dbChainThrows_callsNext', async () => {
      // Arrange — throw synchronously from the db chain so the controller's
      // try/catch catches it cleanly (avoids double-chained Promise rejection).
      const chainError = new Error('Revoke failed');
      mockDbChain.from.mockImplementationOnce(() => { throw chainError; });

      const req = mockReq({ params: { userId: 'user-def' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await resetUserSession(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(chainError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── disableUserSession ──────────────────────────────────────────────────────
  describe('disableUserSession', () => {
    test('test_disableUserSession_happyPath_deactivatesRevokesTokensDeletesCacheReturns200', async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const req = mockReq({ params: { userId: 'user-ghi' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await disableUserSession(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET is_active = FALSE'),
        ['user-ghi']
      );
      expect(mockDbChain.from).toHaveBeenCalledWith('refresh_tokens');
      expect(mockDbChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_revoked: true, revoked_reason: 'admin_disabled' })
      );
      expect(cacheDel).toHaveBeenCalledWith('shopyos:users:user-ghi:auth');
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'disable_user_session', entityId: 'user-ghi' })
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    test('test_disableUserSession_dbQueryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('Deactivate failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { userId: 'user-ghi' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await disableUserSession(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── createUserProfile ───────────────────────────────────────────────────────
  describe('createUserProfile', () => {
    test('test_createUserProfile_missingRequiredFields_returns400', async () => {
      // Arrange — role is missing
      const req = mockReq({
        body: { full_name: 'Jane Doe', email: 'jane@test.com', password: 'secret123' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createUserProfile(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('required') })
      );
      expect(repositories.users.createUser).not.toHaveBeenCalled();
    });

    test('test_createUserProfile_missingEmail_returns400', async () => {
      // Arrange — email is missing
      const req = mockReq({
        body: { full_name: 'Jane Doe', password: 'secret123', role: 'buyer' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createUserProfile(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(repositories.users.createUser).not.toHaveBeenCalled();
    });

    test('test_createUserProfile_happyPath_createsUserProfileRoleSendsNotificationReturns201', async () => {
      // Arrange
      const newUser = { id: 'new-user-id' };
      repositories.users.createUser.mockResolvedValueOnce(newUser);
      repositories.userProfiles.create.mockResolvedValueOnce({});
      repositories.admin.setUserRoleByUserId.mockResolvedValueOnce({});

      const req = mockReq({
        body: {
          full_name: 'Jane Doe',
          email:     'jane@test.com',
          phone:     '0241234567',
          password:  'secret123',
          role:      'seller',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createUserProfile(req, res, next);

      // Assert
      expect(repositories.users.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@test.com', password: 'secret123' })
      );
      expect(repositories.userProfiles.create).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'new-user-id', full_name: 'Jane Doe' })
      );
      expect(repositories.admin.setUserRoleByUserId).toHaveBeenCalledWith('new-user-id', 'seller');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'new-user-id', type: 'admin_broadcast' })
      );
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin_create_user', entityId: 'new-user-id' })
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({ id: 'new-user-id', email: 'jane@test.com', role: 'seller' }),
        })
      );
    });

    test('test_createUserProfile_createUserThrows_callsNext', async () => {
      // Arrange
      const createError = new Error('Duplicate email');
      repositories.users.createUser.mockRejectedValueOnce(createError);

      const req = mockReq({
        body: { full_name: 'Jane Doe', email: 'jane@test.com', password: 'secret123', role: 'buyer' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createUserProfile(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(createError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── createStoreAdmin ────────────────────────────────────────────────────────
  describe('createStoreAdmin', () => {
    test('test_createStoreAdmin_missingOwnerId_returns400', async () => {
      // Arrange
      const req = mockReq({ body: { store_name: 'My Shop' } }); // owner_id missing

      const res = mockRes();
      const next = jest.fn();

      // Act
      await createStoreAdmin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('owner_id') })
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    test('test_createStoreAdmin_missingStoreName_returns400', async () => {
      // Arrange
      const req = mockReq({ body: { owner_id: 'owner-1' } }); // store_name missing

      const res = mockRes();
      const next = jest.fn();

      // Act
      await createStoreAdmin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    test('test_createStoreAdmin_autoVerifyFalse_insertsWithPendingStatusSendsNotificationReturns201', async () => {
      // Arrange
      const storeRow = { id: 'store-xyz', store_name: 'Cool Store', is_verified: false };
      mockPool.query.mockResolvedValueOnce({ rows: [storeRow] });

      const req = mockReq({
        body: {
          owner_id:   'owner-1',
          store_name: 'Cool Store',
          auto_verify: false,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createStoreAdmin(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stores'),
        expect.arrayContaining(['pending', false])
      );
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'owner-1', type: 'business_approved' })
      );
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin_create_store', entityId: 'store-xyz' })
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, store: storeRow })
      );
    });

    test('test_createStoreAdmin_autoVerifyTrue_insertsWithVerifiedStatus', async () => {
      // Arrange
      const storeRow = { id: 'store-xyz', store_name: 'Quick Store', is_verified: true };
      mockPool.query.mockResolvedValueOnce({ rows: [storeRow] });

      const req = mockReq({
        body: {
          owner_id:    'owner-2',
          store_name:  'Quick Store',
          auto_verify: true,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createStoreAdmin(req, res, next);

      // Assert — query params must include 'verified' and boolean true for is_verified
      const queryArgs = mockPool.query.mock.calls[0][1];
      expect(queryArgs).toContain('verified');
      expect(queryArgs).toContain(true);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── createDriverProfileAdmin ─────────────────────────────────────────────────
  describe('createDriverProfileAdmin', () => {
    test('test_createDriverProfileAdmin_missingUserId_returns400', async () => {
      // Arrange
      const req = mockReq({ body: { vehicle_type: 'motorbike' } }); // user_id missing

      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDriverProfileAdmin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('user_id') })
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    test('test_createDriverProfileAdmin_happyPathNoAutoApprove_createsDriverReturns201', async () => {
      // Arrange
      const driverRow = { id: 'driver-1', user_id: 'user-111', is_verified: false };
      mockPool.query.mockResolvedValueOnce({ rows: [driverRow] });

      const req = mockReq({
        body: {
          user_id:        'user-111',
          vehicle_type:   'motorbike',
          plate_number:   'GR-1234-21',
          license_number: 'DL-9999',
          auto_approve:   false,
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDriverProfileAdmin(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO driver_profiles'),
        expect.arrayContaining(['user-111', false])
      );
      expect(repositories.admin.setUserRoleByUserId).not.toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-111', type: 'driver_approved' })
      );
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin_create_driver', entityId: 'driver-1' })
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, driver: driverRow })
      );
    });

    test('test_createDriverProfileAdmin_autoApproveTrue_assignsDriverRole', async () => {
      // Arrange
      const driverRow = { id: 'driver-2', user_id: 'user-222', is_verified: true };
      mockPool.query.mockResolvedValueOnce({ rows: [driverRow] });
      repositories.admin.setUserRoleByUserId.mockResolvedValueOnce({});

      const req = mockReq({
        body: { user_id: 'user-222', auto_approve: true },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await createDriverProfileAdmin(req, res, next);

      // Assert
      expect(repositories.admin.setUserRoleByUserId).toHaveBeenCalledWith('user-222', 'driver');
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ── getDriverStatsAdmin ──────────────────────────────────────────────────────
  describe('getDriverStatsAdmin', () => {
    test('test_getDriverStatsAdmin_driverFound_returns200WithStats', async () => {
      // Arrange
      const statsRow = {
        id: 'driver-1',
        full_name: 'Kofi Driver',
        completed_deliveries: 10,
        avg_rating: 4.5,
      };
      mockPool.query.mockResolvedValueOnce({ rows: [statsRow] });

      const req = mockReq({ params: { id: 'driver-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStatsAdmin(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM driver_profiles'),
        ['driver-1']
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, stats: statsRow })
      );
    });

    test('test_getDriverStatsAdmin_driverNotFound_returns404', async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const req = mockReq({ params: { id: 'ghost-driver' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStatsAdmin(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('not found') })
      );
    });

    test('test_getDriverStatsAdmin_dbQueryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('Stats query failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { id: 'driver-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverStatsAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getDriverHistoryAdmin ────────────────────────────────────────────────────
  describe('getDriverHistoryAdmin', () => {
    test('test_getDriverHistoryAdmin_happyPath_returnsPaginatedDeliveriesWithDefaultLimit20', async () => {
      // Arrange
      const deliveryRows = [{ id: 'del-1' }, { id: 'del-2' }];
      mockPool.query.mockResolvedValueOnce({ rows: deliveryRows });

      const req = mockReq({ params: { id: 'driver-1' }, query: {} }); // no limit/offset
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverHistoryAdmin(req, res, next);

      // Assert
      // Default limit 20, offset 0
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM deliveries'),
        ['driver-1', 20, 0]
      );
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, deliveries: deliveryRows })
      );
    });

    test('test_getDriverHistoryAdmin_customLimitAndOffset_passedToQuery', async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const req = mockReq({
        params: { id: 'driver-1' },
        query:  { limit: '5', offset: '10' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverHistoryAdmin(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        ['driver-1', 5, 10]
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getDriverHistoryAdmin_dbQueryThrows_callsNext', async () => {
      // Arrange
      const dbError = new Error('History query failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { id: 'driver-1' }, query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverHistoryAdmin(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});
