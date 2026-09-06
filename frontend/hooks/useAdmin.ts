import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import {
  getAdminDashboard,
  getAdminAuditLogs,
  getAdminOrders,
  getAdminUsers,
  getAdminUserStats,
  adminUpdateUserStatus,
  getPendingDriverVerifications,
  approveDriverVerification,
  rejectDriverVerification,
} from '@/services/api';

export const useAdminDashboard = () => {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => getAdminDashboard(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
};

export const useAdminAuditLogs = (
  filters: { limit?: number; offset?: number; action?: string; entityType?: string } = {}
) => {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(filters),
    queryFn: () => getAdminAuditLogs(filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
};

export const useAdminOrders = (
  filters: { status?: string; search?: string; limit?: number; offset?: number } = {}
) => {
  return useQuery({
    queryKey: queryKeys.admin.orders(filters),
    queryFn: () => getAdminOrders(filters),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
};

export const useAdminUsers = (filters: object = {}) => {
  return useQuery({
    queryKey: queryKeys.admin.users(filters),
    queryFn: () => getAdminUsers(filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
};

export const useAdminUserStats = () => {
  return useQuery({
    queryKey: queryKeys.admin.userStats(),
    queryFn: () => getAdminUserStats(),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useAdminUpdateUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      status,
      reason,
    }: {
      userId: string;
      status: 'active' | 'suspended' | 'banned';
      reason?: string;
    }) => adminUpdateUserStatus(userId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
};

export const useDriverVerifications = () => {
  return useQuery({
    queryKey: queryKeys.admin.driverVerifications(),
    queryFn: () => getPendingDriverVerifications(),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });
};

export const useApproveDriverVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveDriverVerification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.driverVerifications() });
    },
  });
};

export const useRejectDriverVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectDriverVerification(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.driverVerifications() });
    },
  });
};
