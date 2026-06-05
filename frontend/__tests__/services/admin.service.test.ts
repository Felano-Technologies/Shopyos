/**
 * __tests__/services/admin.service.test.ts
 *
 * Unit tests for the admin service functions.
 * All API calls are mocked — no real network.
 * Conforms to guidelines/test.md.
 */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/query/client', () => ({
  queryClient: { clear: jest.fn(), invalidateQueries: jest.fn(), removeQueries: jest.fn() },
}));
jest.mock('../../components/InAppToastHost', () => ({ CustomInAppToast: { show: jest.fn() } }));
jest.mock('../../services/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  extractErrorMessage: (err: any) => err?.message || 'Unknown error',
  API_URL: 'http://localhost:5000/api/v1/',
  baseURL: 'http://localhost:5000',
  secureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  storage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
  CustomInAppToast: { show: jest.fn() },
}));

import { api } from '../../services/client';
import {
  getAdminDashboard,
  getAdminUsers,
  getAdminUserStats,
  getAdminStores,
  adminVerifyStore,
  getAdminAuditLogs,
  getAdminOrders,
  getAdminRevenue,
  adminUpdateUserStatus,
  getAdminPayouts,
  updateAdminPayoutStatus,
  getPendingDriverVerifications,
  getDriverVerificationDetails,
  approveDriverVerification,
  rejectDriverVerification,
} from '../../services/admin';

describe('Admin Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getAdminDashboard ──────────────────────────────────────────────
  describe('getAdminDashboard', () => {
    test('test_getAdminDashboard_validCall_callsGetAndReturnsDashboardData', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, stats: { totalUsers: 100, totalOrders: 50 } },
      });

      // Act
      const result = await getAdminDashboard();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/dashboard');
      expect(result.success).toBe(true);
      expect(result.stats.totalUsers).toBe(100);
    });

    test('test_getAdminDashboard_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getAdminDashboard()).rejects.toThrow('Unauthorized');
    });
  });

  // ── getAdminUsers ──────────────────────────────────────────────────
  describe('getAdminUsers', () => {
    test('test_getAdminUsers_noParams_callsGetWithEmptyParamsAndReturnsUsers', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, users: [{ id: 'u-1', email: 'user@test.com' }] },
      });

      // Act
      const result = await getAdminUsers();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/users', { params: {} });
      expect(result.users).toHaveLength(1);
    });

    test('test_getAdminUsers_withSearchParams_passesParamsToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, users: [] } });

      // Act
      await getAdminUsers({ search: 'john', limit: 10, offset: 0 });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/users', {
        params: { search: 'john', limit: 10, offset: 0 },
      });
    });

    test('test_getAdminUsers_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Forbidden' });

      // Act & Assert
      await expect(getAdminUsers()).rejects.toThrow('Forbidden');
    });
  });

  // ── getAdminUserStats ──────────────────────────────────────────────
  describe('getAdminUserStats', () => {
    test('test_getAdminUserStats_validCall_callsGetAndReturnsUserStats', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, stats: { active: 80, suspended: 5, banned: 2 } },
      });

      // Act
      const result = await getAdminUserStats();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/users/stats');
      expect(result.success).toBe(true);
    });

    test('test_getAdminUserStats_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Server error' });

      // Act & Assert
      await expect(getAdminUserStats()).rejects.toThrow('Server error');
    });
  });

  // ── getAdminStores ─────────────────────────────────────────────────
  describe('getAdminStores', () => {
    test('test_getAdminStores_noParams_callsGetWithEmptyParamsAndReturnsStores', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, stores: [{ id: 'store-1', name: 'Test Store' }] },
      });

      // Act
      const result = await getAdminStores();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/stores', { params: {} });
      expect(result.stores).toHaveLength(1);
    });

    test('test_getAdminStores_withStatusFilter_passesStatusParamToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, stores: [] } });

      // Act
      await getAdminStores({ status: 'pending' });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/stores', { params: { status: 'pending' } });
    });

    test('test_getAdminStores_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getAdminStores()).rejects.toThrow('Unauthorized');
    });
  });

  // ── adminVerifyStore ───────────────────────────────────────────────
  describe('adminVerifyStore', () => {
    test('test_adminVerifyStore_approveStatus_callsPutWithStatusAndReturnsSuccess', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await adminVerifyStore('store-1', 'verified');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/stores/store-1/verify', {
        status: 'verified',
        reason: undefined,
      });
      expect(result.success).toBe(true);
    });

    test('test_adminVerifyStore_rejectStatusWithReason_callsPutWithStatusAndReason', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await adminVerifyStore('store-2', 'rejected', 'Incomplete documentation');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/stores/store-2/verify', {
        status: 'rejected',
        reason: 'Incomplete documentation',
      });
    });

    test('test_adminVerifyStore_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Store not found' });

      // Act & Assert
      await expect(adminVerifyStore('bad-store', 'verified')).rejects.toThrow('Store not found');
    });
  });

  // ── getAdminAuditLogs ──────────────────────────────────────────────
  describe('getAdminAuditLogs', () => {
    test('test_getAdminAuditLogs_noParams_callsGetWithEmptyParamsAndReturnsLogs', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, logs: [{ id: 'log-1', action: 'USER_BANNED' }] },
      });

      // Act
      const result = await getAdminAuditLogs();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/audit-logs', { params: {} });
      expect(result.logs).toHaveLength(1);
    });

    test('test_getAdminAuditLogs_withFilters_passesParamsToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, logs: [] } });

      // Act
      await getAdminAuditLogs({ action: 'LOGIN', entityType: 'User', limit: 20, offset: 0 });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/audit-logs', {
        params: { action: 'LOGIN', entityType: 'User', limit: 20, offset: 0 },
      });
    });

    test('test_getAdminAuditLogs_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Access denied' });

      // Act & Assert
      await expect(getAdminAuditLogs()).rejects.toThrow('Access denied');
    });
  });

  // ── getAdminOrders ─────────────────────────────────────────────────
  describe('getAdminOrders', () => {
    test('test_getAdminOrders_noParams_callsGetWithEmptyParamsAndReturnsOrders', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, orders: [{ id: 'ord-1', status: 'pending' }] },
      });

      // Act
      const result = await getAdminOrders();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/orders', { params: {} });
      expect(result.orders).toHaveLength(1);
    });

    test('test_getAdminOrders_withStatusAndSearch_passesParamsToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, orders: [] } });

      // Act
      await getAdminOrders({ status: 'delivered', search: 'ord-99', limit: 5, offset: 10 });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/orders', {
        params: { status: 'delivered', search: 'ord-99', limit: 5, offset: 10 },
      });
    });

    test('test_getAdminOrders_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getAdminOrders()).rejects.toThrow('Unauthorized');
    });
  });

  // ── getAdminRevenue ────────────────────────────────────────────────
  describe('getAdminRevenue', () => {
    test('test_getAdminRevenue_noParams_callsGetWithEmptyParamsAndReturnsRevenueData', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, revenue: { total: 50000 } },
      });

      // Act
      const result = await getAdminRevenue();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/revenue', { params: {} });
      expect(result.revenue.total).toBe(50000);
    });

    test('test_getAdminRevenue_withPagination_passesParamsToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await getAdminRevenue({ limit: 10, offset: 20 });

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/revenue', { params: { limit: 10, offset: 20 } });
    });

    test('test_getAdminRevenue_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Server error' });

      // Act & Assert
      await expect(getAdminRevenue()).rejects.toThrow('Server error');
    });
  });

  // ── adminUpdateUserStatus ──────────────────────────────────────────
  describe('adminUpdateUserStatus', () => {
    test('test_adminUpdateUserStatus_suspendWithReason_callsPutWithStatusAndReason', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await adminUpdateUserStatus('u-1', 'suspended', 'Policy violation');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/users/u-1/status', {
        status: 'suspended',
        reason: 'Policy violation',
      });
      expect(result.success).toBe(true);
    });

    test('test_adminUpdateUserStatus_activateWithoutReason_callsPutWithStatusOnly', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await adminUpdateUserStatus('u-2', 'active');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/users/u-2/status', {
        status: 'active',
        reason: undefined,
      });
    });

    test('test_adminUpdateUserStatus_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'User not found' });

      // Act & Assert
      await expect(adminUpdateUserStatus('bad-user', 'banned')).rejects.toThrow('User not found');
    });
  });

  // ── getAdminPayouts ────────────────────────────────────────────────
  describe('getAdminPayouts', () => {
    test('test_getAdminPayouts_noStatus_callsGetWithUndefinedStatusParam', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, payouts: [{ id: 'payout-1' }] },
      });

      // Act
      const result = await getAdminPayouts();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/payouts', { params: { status: undefined } });
      expect(result.payouts).toHaveLength(1);
    });

    test('test_getAdminPayouts_withStatusFilter_passesStatusParamToApiCall', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({ data: { success: true, payouts: [] } });

      // Act
      await getAdminPayouts('pending');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/payouts', { params: { status: 'pending' } });
    });

    test('test_getAdminPayouts_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Forbidden' });

      // Act & Assert
      await expect(getAdminPayouts()).rejects.toThrow('Forbidden');
    });
  });

  // ── updateAdminPayoutStatus ────────────────────────────────────────
  describe('updateAdminPayoutStatus', () => {
    test('test_updateAdminPayoutStatus_completeWithNotes_callsPutWithStatusAndNotes', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await updateAdminPayoutStatus('payout-1', 'completed', 'Processed via bank transfer');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/payouts/payout-1', {
        status: 'completed',
        notes: 'Processed via bank transfer',
      });
      expect(result.success).toBe(true);
    });

    test('test_updateAdminPayoutStatus_rejectWithoutNotes_callsPutWithStatusAndUndefinedNotes', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      await updateAdminPayoutStatus('payout-2', 'rejected');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/payouts/payout-2', {
        status: 'rejected',
        notes: undefined,
      });
    });

    test('test_updateAdminPayoutStatus_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Payout not found' });

      // Act & Assert
      await expect(updateAdminPayoutStatus('bad-payout', 'completed')).rejects.toThrow('Payout not found');
    });
  });

  // ── getPendingDriverVerifications ──────────────────────────────────
  describe('getPendingDriverVerifications', () => {
    test('test_getPendingDriverVerifications_validCall_callsGetAndReturnsPendingList', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, verifications: [{ id: 'dv-1', status: 'pending' }] },
      });

      // Act
      const result = await getPendingDriverVerifications();

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/driver-verifications');
      expect(result.verifications).toHaveLength(1);
    });

    test('test_getPendingDriverVerifications_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Unauthorized' });

      // Act & Assert
      await expect(getPendingDriverVerifications()).rejects.toThrow('Unauthorized');
    });
  });

  // ── getDriverVerificationDetails ───────────────────────────────────
  describe('getDriverVerificationDetails', () => {
    test('test_getDriverVerificationDetails_validId_callsGetWithIdAndReturnsDetails', async () => {
      // Arrange
      (api.get as jest.Mock).mockResolvedValueOnce({
        data: { success: true, verification: { id: 'dv-1', licenseNumber: 'GH-1234' } },
      });

      // Act
      const result = await getDriverVerificationDetails('dv-1');

      // Assert
      expect(api.get).toHaveBeenCalledWith('/admin/driver-verifications/dv-1');
      expect(result.verification.id).toBe('dv-1');
    });

    test('test_getDriverVerificationDetails_invalidId_throwsWithErrorMessage', async () => {
      // Arrange
      (api.get as jest.Mock).mockRejectedValueOnce({ message: 'Verification not found' });

      // Act & Assert
      await expect(getDriverVerificationDetails('bad-id')).rejects.toThrow('Verification not found');
    });
  });

  // ── approveDriverVerification ──────────────────────────────────────
  describe('approveDriverVerification', () => {
    test('test_approveDriverVerification_validId_callsPutToApproveEndpointAndReturnsSuccess', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true, message: 'Driver approved' } });

      // Act
      const result = await approveDriverVerification('dv-1');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/driver-verifications/dv-1/approve');
      expect(result.success).toBe(true);
    });

    test('test_approveDriverVerification_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Verification not found' });

      // Act & Assert
      await expect(approveDriverVerification('bad-dv')).rejects.toThrow('Verification not found');
    });
  });

  // ── rejectDriverVerification ───────────────────────────────────────
  describe('rejectDriverVerification', () => {
    test('test_rejectDriverVerification_validIdAndReason_callsPutToRejectEndpointWithReason', async () => {
      // Arrange
      (api.put as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      // Act
      const result = await rejectDriverVerification('dv-2', 'Invalid documents');

      // Assert
      expect(api.put).toHaveBeenCalledWith('/admin/driver-verifications/dv-2/reject', {
        reason: 'Invalid documents',
      });
      expect(result.success).toBe(true);
    });

    test('test_rejectDriverVerification_apiError_throwsWithErrorMessage', async () => {
      // Arrange
      (api.put as jest.Mock).mockRejectedValueOnce({ message: 'Verification not found' });

      // Act & Assert
      await expect(rejectDriverVerification('bad-dv', 'reason')).rejects.toThrow('Verification not found');
    });
  });
});
