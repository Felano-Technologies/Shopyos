jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  getAdminDashboard: jest.fn(),
  getAdminAuditLogs: jest.fn(),
  getAdminOrders: jest.fn(),
  getAdminUsers: jest.fn(),
  getAdminUserStats: jest.fn(),
  adminUpdateUserStatus: jest.fn(),
  getPendingDriverVerifications: jest.fn(),
  approveDriverVerification: jest.fn(),
  rejectDriverVerification: jest.fn(),
}));

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ApiService from '@/services/api';
import {
  useAdminDashboard,
  useAdminAuditLogs,
  useAdminOrders,
  useAdminUsers,
  useAdminUserStats,
  useAdminUpdateUserStatus,
  useDriverVerifications,
  useApproveDriverVerification,
  useRejectDriverVerification,
} from '../../hooks/useAdmin';
import { queryKeys } from '@/lib/query/keys';

const mockInvalidateQueries = jest.fn();
(useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: mockInvalidateQueries });

describe('useAdmin hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  });

  describe('useAdminDashboard', () => {
    test('test_useAdminDashboard_validCall_invokesUseQueryWithCorrectConfig', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

      const result = useAdminDashboard();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.admin.dashboard(),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getAdminDashboard as jest.Mock).mockResolvedValueOnce({ revenue: 1000 });
      await config.queryFn();
      expect(ApiService.getAdminDashboard).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('useAdminAuditLogs', () => {
    test('test_useAdminAuditLogs_defaultFilters_invokesUseQuery', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { logs: [] }, isLoading: false });

      useAdminAuditLogs();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.admin.auditLogs({}),
        staleTime: 2 * 60 * 1000,
      }));
    });

    test('test_useAdminAuditLogs_withFilters_passesFiltersToQueryFn', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });
      const filters = { limit: 50, action: 'LOGIN' };

      useAdminAuditLogs(filters);

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.admin.auditLogs(filters),
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getAdminAuditLogs as jest.Mock).mockResolvedValueOnce({ logs: [] });
      await config.queryFn();
      expect(ApiService.getAdminAuditLogs).toHaveBeenCalledWith(filters);
    });
  });

  describe('useAdminOrders', () => {
    test('test_useAdminOrders_validCall_invokesUseQuery', () => {
      (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

      useAdminOrders({ status: 'pending' });

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.admin.orders({ status: 'pending' }),
        staleTime: 30 * 1000,
      }));
    });
  });

  describe('useAdminUsers', () => {
    test('test_useAdminUsers_validCall_invokesUseQuery', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { users: [] }, isLoading: false });

      useAdminUsers();

      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getAdminUsers as jest.Mock).mockResolvedValueOnce({ users: [] });
      await config.queryFn();
      expect(ApiService.getAdminUsers).toHaveBeenCalled();
    });
  });

  describe('useAdminUserStats', () => {
    test('test_useAdminUserStats_validCall_invokesUseQuery', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: {}, isLoading: false });

      useAdminUserStats();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.admin.userStats(),
        staleTime: 2 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getAdminUserStats as jest.Mock).mockResolvedValueOnce({ stats: {} });
      await config.queryFn();
      expect(ApiService.getAdminUserStats).toHaveBeenCalled();
    });
  });

  describe('useAdminUpdateUserStatus', () => {
    test('test_useAdminUpdateUserStatus_validCall_configuresMutation', async () => {
      (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

      useAdminUpdateUserStatus();

      expect(useMutation).toHaveBeenCalled();
      const config = (useMutation as jest.Mock).mock.calls[0][0];
      (ApiService.adminUpdateUserStatus as jest.Mock).mockResolvedValueOnce({ success: true });
      await config.mutationFn({ userId: 'u1', status: 'suspended', reason: 'violation' });
      expect(ApiService.adminUpdateUserStatus).toHaveBeenCalledWith('u1', 'suspended', 'violation');
    });

    test('test_useAdminUpdateUserStatus_onSuccess_invalidatesAdminQueries', () => {
      (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

      useAdminUpdateUserStatus();

      const config = (useMutation as jest.Mock).mock.calls[0][0];
      config.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.admin.all });
    });
  });

  describe('useDriverVerifications', () => {
    test('test_useDriverVerifications_validCall_invokesUseQuery', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: [], isLoading: false });

      useDriverVerifications();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.admin.driverVerifications(),
        staleTime: 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (ApiService.getPendingDriverVerifications as jest.Mock).mockResolvedValueOnce([]);
      await config.queryFn();
      expect(ApiService.getPendingDriverVerifications).toHaveBeenCalled();
    });
  });

  describe('useApproveDriverVerification', () => {
    test('test_useApproveDriverVerification_onSuccess_invalidatesVerifications', () => {
      (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

      useApproveDriverVerification();

      const config = (useMutation as jest.Mock).mock.calls[0][0];
      config.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.admin.driverVerifications() });
    });

    test('test_useApproveDriverVerification_mutationFn_callsApproveApi', async () => {
      (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

      useApproveDriverVerification();

      const config = (useMutation as jest.Mock).mock.calls[0][0];
      (ApiService.approveDriverVerification as jest.Mock).mockResolvedValueOnce({ success: true });
      await config.mutationFn('driver-1');
      expect(ApiService.approveDriverVerification).toHaveBeenCalledWith('driver-1');
    });
  });

  describe('useRejectDriverVerification', () => {
    test('test_useRejectDriverVerification_mutationFn_callsRejectApi', async () => {
      (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

      useRejectDriverVerification();

      const config = (useMutation as jest.Mock).mock.calls[0][0];
      (ApiService.rejectDriverVerification as jest.Mock).mockResolvedValueOnce({ success: true });
      await config.mutationFn({ id: 'driver-2', reason: 'documents invalid' });
      expect(ApiService.rejectDriverVerification).toHaveBeenCalledWith('driver-2', 'documents invalid');
    });

    test('test_useRejectDriverVerification_onSuccess_invalidatesVerifications', () => {
      (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });

      useRejectDriverVerification();

      const config = (useMutation as jest.Mock).mock.calls[0][0];
      config.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.admin.driverVerifications() });
    });
  });
});
