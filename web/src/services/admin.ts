import { api } from './client';

export const getAdminDashboard = async () => {
  const response = await api.get('/admin/dashboard');
  return response.data;
};
export const getAdminUsers = async (params?: any) => {
  const response = await api.get('/admin/users', { params });
  return response.data;
};
export const getAdminUserStats = async () => {
  const response = await api.get('/admin/user-stats');
  return response.data;
};
export const getAdminStores = async (params?: any) => {
  const response = await api.get('/admin/stores', { params });
  return response.data;
};
export const adminVerifyStore = async (storeId: string, status: string) => {
  const response = await api.put(`/admin/stores/${storeId}/verify`, { status });
  return response.data;
};
export const getAdminAuditLogs = async (params?: any) => {
  const response = await api.get('/admin/audit-logs', { params });
  return response.data;
};
export const getAdminOrders = async (params?: any) => {
  const response = await api.get('/admin/orders', { params });
  return response.data;
};
export const getAdminRevenue = async () => ({});
export const adminUpdateUserStatus = async () => ({});
export const getAdminPayouts = async () => ({});
export const updateAdminPayoutStatus = async () => ({});
export const getPendingDriverVerifications = async () => ({});
export const getDriverVerificationDetails = async () => ({});
export const approveDriverVerification = async () => ({});
export const rejectDriverVerification = async () => ({});
