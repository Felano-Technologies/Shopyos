import { api, extractErrorMessage } from './client';

export const getAdminDashboard = async () => {
  try {
    const response = await api.get('/admin/dashboard');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminUsers = async (params = {}) => {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminUserStats = async () => {
  try {
    const response = await api.get('/admin/users/stats');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminStores = async (params = {}) => {
  try {
    const response = await api.get('/admin/stores', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminVerifyStore = async (
  storeId: string,
  status: 'verified' | 'rejected' | 'pending',
  reason?: string
) => {
  try {
    const response = await api.put(`/admin/stores/${storeId}/verify`, { status, reason });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminAuditLogs = async (
  params: { limit?: number; offset?: number; action?: string; entityType?: string } = {}
) => {
  try {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminOrders = async (
  params: { status?: string; search?: string; limit?: number; offset?: number } = {}
) => {
  try {
    const response = await api.get('/admin/orders', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminRevenue = async (params: { limit?: number; offset?: number } = {}) => {
  try {
    const response = await api.get('/admin/revenue', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminUpdateUserStatus = async (
  userId: string,
  status: 'active' | 'suspended' | 'banned',
  reason?: string
) => {
  try {
    const response = await api.put(`/admin/users/${userId}/status`, { status, reason });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminPayouts = async (status?: string) => {
  try {
    const response = await api.get('/admin/payouts', { params: { status } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateAdminPayoutStatus = async (
  payoutId: string,
  status: 'completed' | 'rejected',
  notes?: string
) => {
  try {
    const response = await api.put(`/admin/payouts/${payoutId}`, { status, notes });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getPendingDriverVerifications = async () => {
  try {
    const response = await api.get('/admin/driver-verifications');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverVerificationDetails = async (id: string) => {
  try {
    const response = await api.get(`/admin/driver-verifications/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const approveDriverVerification = async (id: string) => {
  try {
    const response = await api.put(`/admin/driver-verifications/${id}/approve`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const rejectDriverVerification = async (id: string, reason: string) => {
  try {
    const response = await api.put(`/admin/driver-verifications/${id}/reject`, { reason });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
