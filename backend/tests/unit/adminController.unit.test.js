'use strict';

/**
 * tests/unit/adminController.unit.test.js
 *
 * Unit tests for adminController functions.
 * Mocks all repositories, services, config modules, and pg pool.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../services/rabbitmq', () => ({
  publishMessage: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/notificationService', () => ({
  sendNotification: jest.fn().mockResolvedValue({}),
  sendPushNotification: jest.fn().mockResolvedValue({}),
}));

// Mock the postgres pool used inside getDashboard
const mockPool = {
  query: jest.fn(),
};
jest.mock('../../config/postgres', () => ({
  getPool: jest.fn(() => mockPool),
}));

jest.mock('../../db/repositories', () => ({
  admin: {
    getAllUsers: jest.fn(),
    getUserStats: jest.fn(),
    updateUserStatus: jest.fn(),
    updateUserRole: jest.fn(),
    getAllStores: jest.fn(),
    updateStoreVerification: jest.fn(),
    updateStoreStatus: jest.fn(),
    getAllOrders: jest.fn(),
    getRevenueTransactions: jest.fn(),
    getDriverVerifications: jest.fn(),
    getDriverVerificationDetails: jest.fn(),
    approveDriver: jest.fn(),
    rejectDriver: jest.fn(),
  },
  auditLogs: {
    createLog: jest.fn().mockResolvedValue({}),
    getAuditLogs: jest.fn(),
    getEntityHistory: jest.fn(),
  },
  stores: {
    findById: jest.fn(),
    update: jest.fn(),
  },
  users: {
    findById: jest.fn(),
  },
  userProfiles: {
    findByUserId: jest.fn(),
  },
  payouts: {
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  },
  reports: {
    getAllReports: jest.fn(),
    getReportDetails: jest.fn(),
    updateReportStatus: jest.fn(),
  },
  orders: {
    findById: jest.fn(),
    getOrderDetails: jest.fn(),
    db: {
      from: jest.fn(),
    },
  },
}));

const repositories = require('../../db/repositories');
const notificationService = require('../../services/notificationService');
const rabbitMQService = require('../../services/rabbitmq');

const {
  getDashboard,
  getAllUsers,
  getUserStats,
  updateUserStatus,
  updateUserRole,
  getAllStores,
  verifyStore,
  updateStoreStatus,
  getAllReports,
  getReportDetails,
  updateReportStatus,
  getAllPayouts,
  updatePayoutStatus,
  getAllOrders,
  getRevenue,
  getDriverVerifications,
  getDriverVerificationDetails,
  approveDriverVerification,
  rejectDriverVerification,
  getAuditLogs,
  getEntityHistory,
  getAllEscrows: _getAllEscrows,
  refundEscrow,
  releaseEscrow,
} = require('../../controllers/adminController');

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'admin-user-id', roles: ['admin'] },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test-agent' },
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('AdminController Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositories.auditLogs.createLog.mockResolvedValue({});
  });

  // ── getDashboard ────────────────────────────────────────────────────
  describe('getDashboard', () => {
    test('test_getDashboard_validAdminRequest_returnsDashboardStats', async () => {
      // Arrange
      const mockRow = {
        total_users: 120,
        total_buyers: 80,
        total_stores: 30,
        total_orders: 450,
        total_revenue: '9800.50',
        pending_driver_verifications: 5,
      };
      mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDashboard(req, res, next);

      // Assert
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stats: {
          totalUsers: 120,
          totalBuyers: 80,
          totalStores: 30,
          totalOrders: 450,
          totalRevenue: 9800.5,
          pendingPayouts: 0,
          activePromotions: 0,
          pendingDriverVerifications: 5,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getDashboard_emptyDbResult_returnsZeroedStats', async () => {
      // Arrange
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDashboard(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stats: {
          totalUsers: 0,
          totalBuyers: 0,
          totalStores: 0,
          totalOrders: 0,
          totalRevenue: 0,
          pendingPayouts: 0,
          activePromotions: 0,
          pendingDriverVerifications: 0,
        },
      });
    });

    test('test_getDashboard_dbQueryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('DB connection failed');
      mockPool.query.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDashboard(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── getAllUsers ─────────────────────────────────────────────────────
  describe('getAllUsers', () => {
    test('test_getAllUsers_defaultQueryParams_returnsUserListWithPagination', async () => {
      // Arrange
      const mockUsers = [{ id: 'user-1', email: 'a@test.com' }, { id: 'user-2', email: 'b@test.com' }];
      repositories.admin.getAllUsers.mockResolvedValueOnce(mockUsers);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllUsers(req, res, next);

      // Assert
      expect(repositories.admin.getAllUsers).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        role: undefined,
        accountStatus: undefined,
        search: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers,
        pagination: { limit: 50, offset: 0 },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getAllUsers_withFilterParams_passesFiltersToRepository', async () => {
      // Arrange
      const mockUsers = [{ id: 'user-3', email: 'c@test.com' }];
      repositories.admin.getAllUsers.mockResolvedValueOnce(mockUsers);

      const req = mockReq({
        query: { limit: '10', offset: '20', role: 'seller', accountStatus: 'active', search: 'john' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllUsers(req, res, next);

      // Assert
      expect(repositories.admin.getAllUsers).toHaveBeenCalledWith({
        limit: 10,
        offset: 20,
        role: 'seller',
        accountStatus: 'active',
        search: 'john',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers,
        pagination: { limit: 10, offset: 20 },
      });
    });

    test('test_getAllUsers_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Query failed');
      repositories.admin.getAllUsers.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllUsers(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ── getUserStats ────────────────────────────────────────────────────
  describe('getUserStats', () => {
    test('test_getUserStats_validRequest_returnsStatsFromRepository', async () => {
      // Arrange
      const mockStats = { totalBuyers: 80, totalSellers: 25, totalDrivers: 15, totalAdmins: 2 };
      repositories.admin.getUserStats.mockResolvedValueOnce(mockStats);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUserStats(req, res, next);

      // Assert
      expect(repositories.admin.getUserStats).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, stats: mockStats });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getUserStats_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Stats query failed');
      repositories.admin.getUserStats.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getUserStats(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── updateUserStatus ────────────────────────────────────────────────
  describe('updateUserStatus', () => {
    test('test_updateUserStatus_invalidStatus_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { userId: 'user-1' },
        body: { status: 'unknown-status', reason: 'test' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateUserStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid status. Must be active, suspended, or banned',
      });
      expect(repositories.admin.updateUserStatus).not.toHaveBeenCalled();
    });

    test('test_updateUserStatus_validActiveStatus_updatesUserAndCreatesAuditLog', async () => {
      // Arrange
      const mockUpdatedUser = { id: 'user-1', account_status: 'active' };
      repositories.admin.updateUserStatus.mockResolvedValueOnce(mockUpdatedUser);

      const req = mockReq({
        params: { userId: 'user-1' },
        body: { status: 'active', reason: 'Reinstated' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateUserStatus(req, res, next);

      // Assert
      expect(repositories.admin.updateUserStatus).toHaveBeenCalledWith('user-1', 'active', 'Reinstated');
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user-id',
          action: 'update_user_status',
          entityType: 'user',
          entityId: 'user-1',
          changes: { status: 'active', reason: 'Reinstated' },
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User status updated successfully',
        user: mockUpdatedUser,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_updateUserStatus_validSuspendedStatus_updatesUser', async () => {
      // Arrange
      const mockUpdatedUser = { id: 'user-2', account_status: 'suspended' };
      repositories.admin.updateUserStatus.mockResolvedValueOnce(mockUpdatedUser);

      const req = mockReq({
        params: { userId: 'user-2' },
        body: { status: 'suspended', reason: 'Violates TOS' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateUserStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, user: mockUpdatedUser })
      );
    });

    test('test_updateUserStatus_validBannedStatus_updatesUser', async () => {
      // Arrange
      const mockUpdatedUser = { id: 'user-3', account_status: 'banned' };
      repositories.admin.updateUserStatus.mockResolvedValueOnce(mockUpdatedUser);

      const req = mockReq({
        params: { userId: 'user-3' },
        body: { status: 'banned', reason: 'Fraudulent activity' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateUserStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updateUserStatus_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Update failed');
      repositories.admin.updateUserStatus.mockRejectedValueOnce(dbError);

      const req = mockReq({
        params: { userId: 'user-1' },
        body: { status: 'active', reason: 'test' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updateUserStatus(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAllStores ────────────────────────────────────────────────────
  describe('getAllStores', () => {
    test('test_getAllStores_defaultQueryParams_returnsStoresWithPagination', async () => {
      // Arrange
      const mockStores = [{ id: 'store-1', store_name: 'Alpha Store' }];
      repositories.admin.getAllStores.mockResolvedValueOnce(mockStores);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllStores(req, res, next);

      // Assert
      expect(repositories.admin.getAllStores).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        verificationStatus: undefined,
        search: undefined,
        id: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        stores: mockStores,
        pagination: { limit: 50, offset: 0 },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getAllStores_withFilterParams_passesFiltersToRepository', async () => {
      // Arrange
      const mockStores = [{ id: 'store-2', store_name: 'Beta Store' }];
      repositories.admin.getAllStores.mockResolvedValueOnce(mockStores);

      const req = mockReq({
        query: { limit: '5', offset: '10', verificationStatus: 'pending', search: 'beta', id: 'store-2' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllStores(req, res, next);

      // Assert
      expect(repositories.admin.getAllStores).toHaveBeenCalledWith({
        limit: 5,
        offset: 10,
        verificationStatus: 'pending',
        search: 'beta',
        id: 'store-2',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getAllStores_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('getAllStores failed');
      repositories.admin.getAllStores.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllStores(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── verifyStore ─────────────────────────────────────────────────────
  describe('verifyStore', () => {
    test('test_verifyStore_invalidVerificationStatus_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { storeId: 'store-1' },
        body: { status: 'approved', reason: '' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyStore(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid verification status',
      });
      expect(repositories.stores.findById).not.toHaveBeenCalled();
    });

    test('test_verifyStore_verifiedStatusWithDocuments_setsTrustedAndNotifiesOwner', async () => {
      // Arrange
      const mockCurrentStore = {
        id: 'store-1',
        owner_id: 'seller-1',
        store_name: 'My Store',
        business_cert_url: 'https://cert.url',
        business_license_url: null,
        proof_of_bank_url: null,
      };
      const mockStore = { id: 'store-1', owner_id: 'seller-1', store_name: 'My Store' };
      const mockOwner = { id: 'seller-1', email: 'seller@test.com' };
      const mockProfile = { full_name: 'Seller Name' };

      repositories.stores.findById.mockResolvedValueOnce(mockCurrentStore);
      repositories.admin.updateStoreVerification.mockResolvedValueOnce(mockStore);
      repositories.stores.update.mockResolvedValueOnce({});
      notificationService.sendNotification.mockResolvedValueOnce({});
      repositories.users.findById.mockResolvedValueOnce(mockOwner);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);

      const req = mockReq({
        params: { storeId: 'store-1' },
        body: { status: 'verified', reason: '' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyStore(req, res, next);

      // Assert
      expect(repositories.admin.updateStoreVerification).toHaveBeenCalledWith('store-1', 'verified', '');
      expect(repositories.stores.update).toHaveBeenCalledWith('store-1', {
        is_verified: true,
        is_trusted: true,
      });
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'seller-1', type: 'business_approved' })
      );
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({
          eventType: 'BUSINESS_VERIFICATION_RESULT',
          userId: 'seller-1',
          templateData: expect.objectContaining({ status: 'verified' }),
        })
      );
      expect(repositories.auditLogs.createLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-user-id',
          action: 'verify_store',
          entityType: 'store',
          entityId: 'store-1',
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Store approved successfully',
        store: mockStore,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_verifyStore_verifiedStatusWithoutDocuments_setsIsNotTrusted', async () => {
      // Arrange
      const mockCurrentStore = {
        id: 'store-2',
        owner_id: 'seller-2',
        store_name: 'Store No Docs',
        business_cert_url: null,
        business_license_url: null,
        proof_of_bank_url: null,
      };
      const mockStore = { id: 'store-2', owner_id: 'seller-2', store_name: 'Store No Docs' };
      const mockOwner = { id: 'seller-2', email: 'seller2@test.com' };
      const mockProfile = { full_name: 'Seller Two' };

      repositories.stores.findById.mockResolvedValueOnce(mockCurrentStore);
      repositories.admin.updateStoreVerification.mockResolvedValueOnce(mockStore);
      repositories.stores.update.mockResolvedValueOnce({});
      notificationService.sendNotification.mockResolvedValueOnce({});
      repositories.users.findById.mockResolvedValueOnce(mockOwner);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);

      const req = mockReq({
        params: { storeId: 'store-2' },
        body: { status: 'verified', reason: '' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyStore(req, res, next);

      // Assert
      expect(repositories.stores.update).toHaveBeenCalledWith('store-2', {
        is_verified: true,
        is_trusted: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_verifyStore_rejectedStatus_sendsEmailAndNoApprovalNotification', async () => {
      // Arrange
      const mockCurrentStore = {
        id: 'store-3',
        owner_id: 'seller-3',
        store_name: 'Rejected Store',
        business_cert_url: null,
        business_license_url: null,
        proof_of_bank_url: null,
      };
      const mockStore = { id: 'store-3', owner_id: 'seller-3', store_name: 'Rejected Store' };
      const mockOwner = { id: 'seller-3', email: 'seller3@test.com' };
      const mockProfile = { full_name: 'Seller Three' };

      repositories.stores.findById.mockResolvedValueOnce(mockCurrentStore);
      repositories.admin.updateStoreVerification.mockResolvedValueOnce(mockStore);
      repositories.stores.update.mockResolvedValueOnce({});
      repositories.users.findById.mockResolvedValueOnce(mockOwner);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);

      const req = mockReq({
        params: { storeId: 'store-3' },
        body: { status: 'rejected', reason: 'Missing documents' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyStore(req, res, next);

      // Assert
      // No push notification for rejected status
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({ eventType: 'BUSINESS_VERIFICATION_RESULT' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Store rejected successfully',
        store: mockStore,
      });
    });

    test('test_verifyStore_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('findById failed');
      repositories.stores.findById.mockRejectedValueOnce(dbError);

      const req = mockReq({
        params: { storeId: 'store-1' },
        body: { status: 'verified', reason: '' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await verifyStore(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAllPayouts ───────────────────────────────────────────────────
  describe('getAllPayouts', () => {
    test('test_getAllPayouts_noStatusFilter_returnsAllPayouts', async () => {
      // Arrange
      const mockPayouts = [{ id: 'pay-1', amount: 150, status: 'pending' }];
      repositories.payouts.findAll.mockResolvedValueOnce(mockPayouts);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllPayouts(req, res, next);

      // Assert
      expect(repositories.payouts.findAll).toHaveBeenCalledWith({
        where: {},
        orderBy: 'created_at',
        ascending: false,
        limit: 50,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockPayouts,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getAllPayouts_withStatusFilter_passesStatusToRepository', async () => {
      // Arrange
      const mockPayouts = [{ id: 'pay-2', amount: 200, status: 'completed' }];
      repositories.payouts.findAll.mockResolvedValueOnce(mockPayouts);

      const req = mockReq({ query: { status: 'completed', limit: '10', offset: '5' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllPayouts(req, res, next);

      // Assert
      expect(repositories.payouts.findAll).toHaveBeenCalledWith({
        where: { status: 'completed' },
        orderBy: 'created_at',
        ascending: false,
        limit: 10,
        offset: 5,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getAllPayouts_repositoryReturnsObjectWithDataField_returnsDataArray', async () => {
      // Arrange
      const mockPayoutsObj = { data: [{ id: 'pay-3' }], count: 1 };
      repositories.payouts.findAll.mockResolvedValueOnce(mockPayoutsObj);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllPayouts(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: 'pay-3' }],
      });
    });

    test('test_getAllPayouts_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Payout fetch failed');
      repositories.payouts.findAll.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllPayouts(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── updatePayoutStatus ──────────────────────────────────────────────
  describe('updatePayoutStatus', () => {
    test('test_updatePayoutStatus_payoutNotFound_returns404NotFound', async () => {
      // Arrange
      repositories.payouts.findById.mockResolvedValueOnce(null);

      const req = mockReq({
        params: { payoutId: 'ghost-payout' },
        body: { status: 'completed', notes: '' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updatePayoutStatus(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Payout not found' });
      expect(repositories.payouts.update).not.toHaveBeenCalled();
    });

    test('test_updatePayoutStatus_validCompletedStatus_updatesPayoutWithTimestamp', async () => {
      // Arrange
      const mockPayout = { id: 'pay-1', notes: 'Initial note', status: 'pending' };
      const mockUpdated = { id: 'pay-1', status: 'completed', processed_at: '2026-06-05T00:00:00.000Z' };
      repositories.payouts.findById.mockResolvedValueOnce(mockPayout);
      repositories.payouts.update.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({
        params: { payoutId: 'pay-1' },
        body: { status: 'completed', notes: 'Processed via bank' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updatePayoutStatus(req, res, next);

      // Assert
      expect(repositories.payouts.update).toHaveBeenCalledWith(
        'pay-1',
        expect.objectContaining({
          status: 'completed',
          notes: 'Processed via bank',
        })
      );
      // processed_at should be set (non-null) for completed status
      const callArg = repositories.payouts.update.mock.calls[0][1];
      expect(callArg.processed_at).not.toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payout completed successfully',
        data: mockUpdated,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_updatePayoutStatus_nonCompletedStatus_setsProcessedAtNull', async () => {
      // Arrange
      const mockPayout = { id: 'pay-2', notes: null, status: 'pending' };
      const mockUpdated = { id: 'pay-2', status: 'rejected', processed_at: null };
      repositories.payouts.findById.mockResolvedValueOnce(mockPayout);
      repositories.payouts.update.mockResolvedValueOnce(mockUpdated);

      const req = mockReq({
        params: { payoutId: 'pay-2' },
        body: { status: 'rejected', notes: '' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updatePayoutStatus(req, res, next);

      // Assert
      const callArg = repositories.payouts.update.mock.calls[0][1];
      expect(callArg.processed_at).toBeNull();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_updatePayoutStatus_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Update payout failed');
      repositories.payouts.findById.mockRejectedValueOnce(dbError);

      const req = mockReq({
        params: { payoutId: 'pay-1' },
        body: { status: 'completed' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await updatePayoutStatus(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAllOrders ────────────────────────────────────────────────────
  describe('getAllOrders', () => {
    test('test_getAllOrders_defaultQueryParams_returnsOrders', async () => {
      // Arrange
      const mockOrders = [{ id: 'ord-1', status: 'pending' }];
      repositories.admin.getAllOrders.mockResolvedValueOnce(mockOrders);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllOrders(req, res, next);

      // Assert
      expect(repositories.admin.getAllOrders).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
        status: undefined,
        search: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, orders: mockOrders });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getAllOrders_withStatusAndSearch_passesParamsToRepository', async () => {
      // Arrange
      const mockOrders = [{ id: 'ord-2', status: 'paid' }];
      repositories.admin.getAllOrders.mockResolvedValueOnce(mockOrders);

      const req = mockReq({
        query: { limit: '20', offset: '10', status: 'paid', search: 'ORD-2' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllOrders(req, res, next);

      // Assert
      expect(repositories.admin.getAllOrders).toHaveBeenCalledWith({
        limit: 20,
        offset: 10,
        status: 'paid',
        search: 'ORD-2',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_getAllOrders_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('getAllOrders failed');
      repositories.admin.getAllOrders.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAllOrders(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getRevenue ──────────────────────────────────────────────────────
  describe('getRevenue', () => {
    test('test_getRevenue_validRequest_returnsTransactionsWithTotal', async () => {
      // Arrange
      const mockTransactions = [
        { id: 'tx-1', amount: '100.00' },
        { id: 'tx-2', amount: '250.50' },
      ];
      repositories.admin.getRevenueTransactions.mockResolvedValueOnce(mockTransactions);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getRevenue(req, res, next);

      // Assert
      expect(repositories.admin.getRevenueTransactions).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transactions: mockTransactions,
        total: 350.5,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getRevenue_emptyTransactions_returnsTotalOfZero', async () => {
      // Arrange
      repositories.admin.getRevenueTransactions.mockResolvedValueOnce([]);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getRevenue(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        transactions: [],
        total: 0,
      });
    });

    test('test_getRevenue_withPaginationParams_passesParamsToRepository', async () => {
      // Arrange
      repositories.admin.getRevenueTransactions.mockResolvedValueOnce([]);

      const req = mockReq({ query: { limit: '25', offset: '50' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getRevenue(req, res, next);

      // Assert
      expect(repositories.admin.getRevenueTransactions).toHaveBeenCalledWith({
        limit: 25,
        offset: 50,
      });
    });

    test('test_getRevenue_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Revenue query failed');
      repositories.admin.getRevenueTransactions.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getRevenue(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getDriverVerifications ──────────────────────────────────────────
  describe('getDriverVerifications', () => {
    test('test_getDriverVerifications_validRequest_returnsDriverList', async () => {
      // Arrange
      const mockDrivers = [{ id: 'drv-1', is_verified: false }];
      repositories.admin.getDriverVerifications.mockResolvedValueOnce(mockDrivers);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverVerifications(req, res, next);

      // Assert
      expect(repositories.admin.getDriverVerifications).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, drivers: mockDrivers });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getDriverVerifications_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Driver fetch failed');
      repositories.admin.getDriverVerifications.mockRejectedValueOnce(dbError);

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getDriverVerifications(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── approveDriverVerification ───────────────────────────────────────
  describe('approveDriverVerification', () => {
    test('test_approveDriverVerification_driverWithUser_approvesAndSendsNotifications', async () => {
      // Arrange
      const mockDriver = { id: 'drv-1', user_id: 'user-drv-1', is_verified: true };
      const mockUser = { id: 'user-drv-1', email: 'driver@test.com' };
      const mockProfile = { full_name: 'Driver One' };

      repositories.admin.approveDriver.mockResolvedValueOnce(mockDriver);
      repositories.users.findById.mockResolvedValueOnce(mockUser);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);
      notificationService.sendNotification.mockResolvedValueOnce({});

      const req = mockReq({ params: { id: 'drv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await approveDriverVerification(req, res, next);

      // Assert
      expect(repositories.admin.approveDriver).toHaveBeenCalledWith('drv-1');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-drv-1',
          type: 'driver_approved',
          title: 'Driver Account Approved',
        })
      );
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({
          eventType: 'DRIVER_VERIFICATION_RESULT',
          userId: 'user-drv-1',
          email: 'driver@test.com',
          templateData: expect.objectContaining({
            driverName: 'Driver One',
            status: 'approved',
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Driver approved successfully',
        driver: mockDriver,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_approveDriverVerification_driverWithNoEmail_skipsEmailPublish', async () => {
      // Arrange
      const mockDriver = { id: 'drv-2', user_id: 'user-drv-2', is_verified: true };
      const mockUserNoEmail = { id: 'user-drv-2', email: null };
      const mockProfile = { full_name: 'Driver Two' };

      repositories.admin.approveDriver.mockResolvedValueOnce(mockDriver);
      repositories.users.findById.mockResolvedValueOnce(mockUserNoEmail);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);
      notificationService.sendNotification.mockResolvedValueOnce({});

      const req = mockReq({ params: { id: 'drv-2' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await approveDriverVerification(req, res, next);

      // Assert
      expect(rabbitMQService.publishMessage).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_approveDriverVerification_driverWithNoUserId_skipsNotificationsAndResponds', async () => {
      // Arrange
      const mockDriver = { id: 'drv-3', user_id: null };
      repositories.admin.approveDriver.mockResolvedValueOnce(mockDriver);

      const req = mockReq({ params: { id: 'drv-3' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await approveDriverVerification(req, res, next);

      // Assert
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      expect(rabbitMQService.publishMessage).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Driver approved successfully',
        driver: mockDriver,
      });
    });

    test('test_approveDriverVerification_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('approveDriver failed');
      repositories.admin.approveDriver.mockRejectedValueOnce(dbError);

      const req = mockReq({ params: { id: 'drv-1' } });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await approveDriverVerification(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── rejectDriverVerification ────────────────────────────────────────
  describe('rejectDriverVerification', () => {
    test('test_rejectDriverVerification_missingReason_returns400BadRequest', async () => {
      // Arrange
      const req = mockReq({
        params: { id: 'drv-1' },
        body: {},
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await rejectDriverVerification(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Reason is required' });
      expect(repositories.admin.rejectDriver).not.toHaveBeenCalled();
    });

    test('test_rejectDriverVerification_validReasonWithUser_rejectsAndSendsNotifications', async () => {
      // Arrange
      const mockDriver = { id: 'drv-1', user_id: 'user-drv-1' };
      const mockUser = { id: 'user-drv-1', email: 'driver@test.com' };
      const mockProfile = { full_name: 'Driver One' };

      repositories.admin.rejectDriver.mockResolvedValueOnce(mockDriver);
      repositories.users.findById.mockResolvedValueOnce(mockUser);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);
      notificationService.sendNotification.mockResolvedValueOnce({});

      const req = mockReq({
        params: { id: 'drv-1' },
        body: { reason: 'Invalid documents' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await rejectDriverVerification(req, res, next);

      // Assert
      expect(repositories.admin.rejectDriver).toHaveBeenCalledWith('drv-1', 'Invalid documents');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-drv-1',
          type: 'driver_rejected',
          title: 'Driver Account Rejected',
          message: 'Your driver account verification was rejected. Reason: Invalid documents',
        })
      );
      expect(rabbitMQService.publishMessage).toHaveBeenCalledWith(
        'email',
        expect.objectContaining({
          eventType: 'DRIVER_VERIFICATION_RESULT',
          templateData: expect.objectContaining({
            status: 'rejected',
            reason: 'Invalid documents',
          }),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Driver rejected successfully',
        driver: mockDriver,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_rejectDriverVerification_driverWithNoUserId_skipsNotificationsAndResponds', async () => {
      // Arrange
      const mockDriver = { id: 'drv-4', user_id: null };
      repositories.admin.rejectDriver.mockResolvedValueOnce(mockDriver);

      const req = mockReq({
        params: { id: 'drv-4' },
        body: { reason: 'Documents expired' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await rejectDriverVerification(req, res, next);

      // Assert
      expect(notificationService.sendNotification).not.toHaveBeenCalled();
      expect(rabbitMQService.publishMessage).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_rejectDriverVerification_driverWithNoEmail_skipsEmailPublish', async () => {
      // Arrange
      const mockDriver = { id: 'drv-5', user_id: 'user-drv-5' };
      const mockUserNoEmail = { id: 'user-drv-5', email: null };
      const mockProfile = { full_name: 'Driver Five' };

      repositories.admin.rejectDriver.mockResolvedValueOnce(mockDriver);
      repositories.users.findById.mockResolvedValueOnce(mockUserNoEmail);
      repositories.userProfiles.findByUserId.mockResolvedValueOnce(mockProfile);
      notificationService.sendNotification.mockResolvedValueOnce({});

      const req = mockReq({
        params: { id: 'drv-5' },
        body: { reason: 'Photo unclear' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await rejectDriverVerification(req, res, next);

      // Assert
      expect(rabbitMQService.publishMessage).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('test_rejectDriverVerification_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('rejectDriver failed');
      repositories.admin.rejectDriver.mockRejectedValueOnce(dbError);

      const req = mockReq({
        params: { id: 'drv-1' },
        body: { reason: 'Expired license' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await rejectDriverVerification(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── getAuditLogs ────────────────────────────────────────────────────
  describe('getAuditLogs', () => {
    test('test_getAuditLogs_defaultQueryParams_returnsLogsWithPagination', async () => {
      // Arrange
      const mockLogs = [{ id: 'log-1', action: 'update_user_status', entity_type: 'user' }];
      repositories.auditLogs.getAuditLogs.mockResolvedValueOnce(mockLogs);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAuditLogs(req, res, next);

      // Assert
      expect(repositories.auditLogs.getAuditLogs).toHaveBeenCalledWith({
        userId: undefined,
        action: undefined,
        entityType: undefined,
        startDate: undefined,
        endDate: undefined,
        limit: 100,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: mockLogs,
        pagination: { limit: 100, offset: 0 },
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('test_getAuditLogs_withAllFilterParams_passesFiltersToRepository', async () => {
      // Arrange
      const mockLogs = [];
      repositories.auditLogs.getAuditLogs.mockResolvedValueOnce(mockLogs);

      const req = mockReq({
        query: {
          userId: 'user-99',
          action: 'verify_store',
          entityType: 'store',
          startDate: '2026-01-01',
          endDate: '2026-06-01',
          limit: '25',
          offset: '50',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAuditLogs(req, res, next);

      // Assert
      expect(repositories.auditLogs.getAuditLogs).toHaveBeenCalledWith({
        userId: 'user-99',
        action: 'verify_store',
        entityType: 'store',
        startDate: '2026-01-01',
        endDate: '2026-06-01',
        limit: 25,
        offset: 50,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: mockLogs,
        pagination: { limit: 25, offset: 50 },
      });
    });

    test('test_getAuditLogs_repositoryThrows_callsNextWithError', async () => {
      // Arrange
      const dbError = new Error('Audit log query failed');
      repositories.auditLogs.getAuditLogs.mockRejectedValueOnce(dbError);

      const req = mockReq({ query: {} });
      const res = mockRes();
      const next = jest.fn();

      // Act
      await getAuditLogs(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  // ── updateUserRole ──────────────────────────────────────────────────
  describe('updateUserRole', () => {
    test('test_updateUserRole_invalidRole_returns400', async () => {
      const req = mockReq({ params: { userId: 'u-1' }, body: { role: 'superuser' } });
      const res = mockRes();
      await updateUserRole(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid role' });
    });

    test('test_updateUserRole_validRole_updatesAndReturns200', async () => {
      const updatedUser = { id: 'u-1', role: 'seller' };
      repositories.admin.updateUserRole.mockResolvedValueOnce(updatedUser);
      const req = mockReq({ params: { userId: 'u-1' }, body: { role: 'seller' } });
      const res = mockRes();
      await updateUserRole(req, res, jest.fn());
      expect(repositories.admin.updateUserRole).toHaveBeenCalledWith('u-1', 'seller');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, user: updatedUser }));
    });

    test('test_updateUserRole_repoThrows_callsNext', async () => {
      repositories.admin.updateUserRole.mockRejectedValueOnce(new Error('DB error'));
      const next = jest.fn();
      await updateUserRole(mockReq({ params: { userId: 'u-1' }, body: { role: 'driver' } }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── updateStoreStatus ───────────────────────────────────────────────
  describe('updateStoreStatus', () => {
    test('test_updateStoreStatus_invalidStatus_returns400', async () => {
      const req = mockReq({ params: { storeId: 's-1' }, body: { status: 'deleted' } });
      const res = mockRes();
      await updateStoreStatus(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid status' });
    });

    test('test_updateStoreStatus_validStatus_returns200', async () => {
      const store = { id: 's-1', status: 'suspended' };
      repositories.admin.updateStoreStatus.mockResolvedValueOnce(store);
      const req = mockReq({ params: { storeId: 's-1' }, body: { status: 'suspended' } });
      const res = mockRes();
      await updateStoreStatus(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, store }));
    });
  });

  // ── getAllReports ────────────────────────────────────────────────────
  describe('getAllReports', () => {
    test('test_getAllReports_returnsReportsWithPagination', async () => {
      const reports = [{ id: 'r-1' }];
      repositories.reports.getAllReports.mockResolvedValueOnce(reports);
      const req = mockReq({ query: { limit: '10', offset: '0' } });
      const res = mockRes();
      await getAllReports(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, reports, pagination: { limit: 10, offset: 0 } });
    });

    test('test_getAllReports_repoThrows_callsNext', async () => {
      repositories.reports.getAllReports.mockRejectedValueOnce(new Error('DB'));
      const next = jest.fn();
      await getAllReports(mockReq(), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── getReportDetails ─────────────────────────────────────────────────
  describe('getReportDetails', () => {
    test('test_getReportDetails_returnsReport', async () => {
      const report = { id: 'r-1', status: 'pending' };
      repositories.reports.getReportDetails.mockResolvedValueOnce(report);
      const req = mockReq({ params: { reportId: 'r-1' } });
      const res = mockRes();
      await getReportDetails(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, report });
    });
  });

  // ── updateReportStatus ───────────────────────────────────────────────
  describe('updateReportStatus', () => {
    test('test_updateReportStatus_invalidStatus_returns400', async () => {
      const req = mockReq({ params: { reportId: 'r-1' }, body: { status: 'archived' } });
      const res = mockRes();
      await updateReportStatus(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid status' });
    });

    test('test_updateReportStatus_validStatus_returns200', async () => {
      const report = { id: 'r-1', status: 'resolved' };
      repositories.reports.updateReportStatus.mockResolvedValueOnce(report);
      const req = mockReq({ params: { reportId: 'r-1' }, body: { status: 'resolved', resolution: 'handled' } });
      const res = mockRes();
      await updateReportStatus(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, report }));
    });
  });

  // ── getEntityHistory ─────────────────────────────────────────────────
  describe('getEntityHistory', () => {
    test('test_getEntityHistory_returnsHistory', async () => {
      const history = [{ action: 'verify_store' }];
      repositories.auditLogs.getEntityHistory.mockResolvedValueOnce(history);
      const req = mockReq({ params: { entityType: 'store', entityId: 's-1' } });
      const res = mockRes();
      await getEntityHistory(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, history });
    });

    test('test_getEntityHistory_repoThrows_callsNext', async () => {
      repositories.auditLogs.getEntityHistory.mockRejectedValueOnce(new Error('DB'));
      const next = jest.fn();
      await getEntityHistory(mockReq({ params: { entityType: 'order', entityId: 'o-1' } }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ── getDriverVerificationDetails ─────────────────────────────────────
  describe('getDriverVerificationDetails', () => {
    test('test_getDriverVerificationDetails_notFound_returns404', async () => {
      repositories.admin.getDriverVerificationDetails.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'drv-1' } });
      const res = mockRes();
      await getDriverVerificationDetails(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Driver not found' });
    });

    test('test_getDriverVerificationDetails_found_returns200', async () => {
      const driver = { id: 'drv-1', name: 'Kofi' };
      repositories.admin.getDriverVerificationDetails.mockResolvedValueOnce(driver);
      const req = mockReq({ params: { id: 'drv-1' } });
      const res = mockRes();
      await getDriverVerificationDetails(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, driver });
    });
  });

  // ── refundEscrow ─────────────────────────────────────────────────────
  describe('refundEscrow', () => {
    test('test_refundEscrow_orderNotFound_returns404', async () => {
      repositories.orders.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ord-1' }, body: { reason: 'test' } });
      const res = mockRes();
      await refundEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_refundEscrow_wrongEscrowStatus_returns400', async () => {
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', escrow_status: 'RELEASED' });
      const req = mockReq({ params: { id: 'ord-1' }, body: {} });
      const res = mockRes();
      await refundEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Order is not in an escrow holding state' }));
    });

    test('test_refundEscrow_concurrentUpdate_returns409', async () => {
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', escrow_status: 'HELD' });
      const chainMock = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue({ data: [], error: null }) };
      repositories.orders.db.from.mockReturnValueOnce(chainMock);
      const req = mockReq({ params: { id: 'ord-1' }, body: {} });
      const res = mockRes();
      await refundEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('test_refundEscrow_success_returns200', async () => {
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', escrow_status: 'HELD' });
      const updated = { id: 'ord-1', escrow_status: 'REFUNDED' };
      const chainMock = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue({ data: [updated], error: null }) };
      repositories.orders.db.from.mockReturnValueOnce(chainMock);
      const req = mockReq({ params: { id: 'ord-1' }, body: { reason: 'dispute resolved' } });
      const res = mockRes();
      await refundEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, order: updated }));
    });
  });

  // ── releaseEscrow ─────────────────────────────────────────────────────
  describe('releaseEscrow', () => {
    test('test_releaseEscrow_orderNotFound_returns404', async () => {
      repositories.orders.findById.mockResolvedValueOnce(null);
      const req = mockReq({ params: { id: 'ord-1' }, body: {} });
      const res = mockRes();
      await releaseEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('test_releaseEscrow_wrongEscrowStatus_returns400', async () => {
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', escrow_status: 'REFUNDED' });
      const req = mockReq({ params: { id: 'ord-1' }, body: {} });
      const res = mockRes();
      await releaseEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_releaseEscrow_rpcFails_returns400', async () => {
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', escrow_status: 'HELD' });
      const _rpcMock = { rpc: jest.fn().mockResolvedValue({ data: { success: false, error: 'Already released' }, error: null }) };
      repositories.orders.db.rpc = jest.fn().mockResolvedValue({ data: { success: false, error: 'Already released' }, error: null });
      const req = mockReq({ params: { id: 'ord-1' }, body: {} });
      const res = mockRes();
      await releaseEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('test_releaseEscrow_success_returns200', async () => {
      repositories.orders.findById.mockResolvedValueOnce({ id: 'ord-1', escrow_status: 'HELD' });
      repositories.orders.db.rpc = jest.fn().mockResolvedValue({ data: { success: true }, error: null });
      const updatedOrder = { id: 'ord-1', escrow_status: 'RELEASED' };
      repositories.orders.getOrderDetails.mockResolvedValueOnce(updatedOrder);
      const req = mockReq({ params: { id: 'ord-1' }, body: { reason: 'delivered' } });
      const res = mockRes();
      await releaseEscrow(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, order: updatedOrder }));
    });
  });
});
