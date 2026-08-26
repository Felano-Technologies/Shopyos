import { api } from './client';

export const getAdminDashboard = async () => { const response = await api.get('/admin/dashboard'); return response.data; };
export const getAdminUsers = async (params?: any) => { const response = await api.get('/admin/users', { params }); return response.data; };
export const getAdminUserStats = async () => { const response = await api.get('/admin/user-stats'); return response.data; };
export const getAdminStores = async (params?: any) => { const response = await api.get('/admin/stores', { params }); return response.data; };
export const adminVerifyStore = async (storeId: string, status: string) => { const response = await api.put(`/admin/stores/${storeId}/verify`, { status }); return response.data; };
export const getAdminAuditLogs = async (params?: any) => { const response = await api.get('/admin/audit-logs', { params }); return response.data; };
export const getAdminOrders = async (params?: any) => { const response = await api.get('/admin/orders', { params }); return response.data; };

// Revenue & Payouts
export const getAdminRevenue = async () => { const response = await api.get('/admin/revenue'); return response.data; };
export const getAdminPayouts = async (params?: any) => { const response = await api.get('/admin/payouts', { params }); return response.data; };
export const updateAdminPayoutStatus = async (id: string, status: string, notes?: string) => { const response = await api.put(`/admin/payouts/${id}/status`, { status, notes }); return response.data; };

// Drivers
export const getPendingDriverVerifications = async () => { const response = await api.get('/admin/drivers/pending'); return response.data; };
export const getDriverVerificationDetails = async (id: string) => { const response = await api.get(`/admin/drivers/${id}`); return response.data; };
export const approveDriverVerification = async (id: string) => { const response = await api.post(`/admin/drivers/${id}/approve`); return response.data; };
export const rejectDriverVerification = async (id: string, reason: string) => { const response = await api.post(`/admin/drivers/${id}/reject`, { reason }); return response.data; };

export const adminUpdateUserStatus = async (userId: string, is_active: boolean) => {
  const response = await api.put(`/admin/users/${userId}/status`, { is_active });
  return response.data;
};

// Configs
export const getAdminFeeConfigs = async (category: string) => {
  const response = await api.get(`/admin/fee-configs/${category}`);
  return response.data;
};
export const updateAdminFeeConfig = async (id: string, updates: any) => {
  const response = await api.put(`/admin/fee-configs/${id}`, updates);
  return response.data;
};
export const getAdminFeeConfigAudit = async (category: string) => {
  const response = await api.get(`/admin/fee-configs/${category}/audit`);
  return response.data;
};

// Listing Fees
export const getListingFees = async () => {
  const response = await api.get('/admin/listing-fees');
  return response.data;
};
export const updateListingFee = async (id: string, updates: any) => {
  const response = await api.put(`/admin/listing-fees/${id}`, updates);
  return response.data;
};

// Disclaimers
export const getAdminDisclaimers = async () => {
  const response = await api.get('/admin/disclaimers');
  return response.data;
};
export const createDisclaimer = async (data: any) => {
  const response = await api.post('/admin/disclaimers', data);
  return response.data;
};
export const updateDisclaimer = async (id: string, data: any) => {
  const response = await api.put(`/admin/disclaimers/${id}`, data);
  return response.data;
};
export const deleteDisclaimer = async (id: string) => {
  const response = await api.delete(`/admin/disclaimers/${id}`);
  return response.data;
};

// Hubs
export const adminGetAllHubs = async () => { const response = await api.get('/admin/hubs'); return response.data; };
export const adminCreateHub = async (data: any) => { const response = await api.post('/admin/hubs', data); return response.data; };
export const adminUpdateHub = async (id: string, data: any) => { const response = await api.put(`/admin/hubs/${id}`, data); return response.data; };
export const adminToggleHub = async (id: string, is_active: boolean) => { const response = await api.put(`/admin/hubs/${id}/toggle`, { is_active }); return response.data; };

export const adminGetTransitRoutes = async () => { const response = await api.get('/admin/transit-routes'); return response.data; };
export const adminUpsertTransitRoute = async (data: any) => { const response = await api.post('/admin/transit-routes', data); return response.data; };

// Settings
export const getAdminPlatformSettings = async () => { const response = await api.get('/admin/settings'); return response.data; };
export const updateAdminPlatformSettings = async (updates: any) => { const response = await api.put('/admin/settings', updates); return response.data; };
