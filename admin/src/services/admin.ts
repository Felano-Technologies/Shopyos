import { api } from './client';

export const getAdminDashboard = async () => { const response = await api.get('/admin/dashboard'); return response.data; };
export const getDashboardRevenueTrend = async (days = 14) => { const response = await api.get('/admin/dashboard/revenue-trend', { params: { days } }); return response.data; };
export const getDashboardUserGrowth = async (days = 14) => { const response = await api.get('/admin/dashboard/user-growth', { params: { days } }); return response.data; };
export const getAdminRevenueBreakdown = async (period: 'week' | 'month' | 'year' = 'month') => { const response = await api.get('/admin/revenue-breakdown', { params: { period } }); return response.data; };
export const getAdminUsers = async (params?: any) => { const response = await api.get('/admin/users', { params }); return response.data; };
export const getAdminUserStats = async () => { const response = await api.get('/admin/users/stats'); return response.data; };
export const createAdminUser = async (data: { full_name: string; email: string; phone?: string; password: string; role: string }) => {
  const response = await api.post('/admin/users/create', data);
  return response.data;
};
export const getAdminStores = async (params?: any) => { const response = await api.get('/admin/stores', { params }); return response.data; };
export const getAdminStoreStats = async () => { const response = await api.get('/admin/stores/stats'); return response.data; };
export const getAdminTopStores = async (limit = 5) => { const response = await api.get('/admin/stores/top', { params: { limit } }); return response.data; };
export const adminVerifyStore = async (storeId: string, status: string, reason?: string) => {
  const response = await api.put(`/admin/stores/${storeId}/verify`, { status, reason });
  return response.data;
};
export const getAdminAuditLogs = async (params?: any) => { const response = await api.get('/admin/audit-logs', { params }); return response.data; };
export const getAdminOrders = async (params?: any) => { const response = await api.get('/admin/orders', { params }); return response.data; };
export const getAdminOrderStats = async () => { const response = await api.get('/admin/orders/stats'); return response.data; };
export const updateOrderStatus = async (orderId: string, status: string) => {
  const response = await api.put(`/orders/${orderId}/status`, { status });
  return response.data;
};

// Deliveries (dispatch/logistics — distinct from the order itself)
export const getAdminDeliveries = async (params?: any) => { const response = await api.get('/admin/deliveries', { params }); return response.data; };
export const getAdminDeliveryStats = async () => { const response = await api.get('/admin/deliveries/stats'); return response.data; };

// Revenue & Payouts
export const getAdminRevenue = async () => { const response = await api.get('/admin/revenue'); return response.data; };
export const getAdminPayouts = async (params?: any) => { const response = await api.get('/admin/payouts', { params }); return response.data; };
export const updateAdminPayoutStatus = async (id: string, status: string, notes?: string) => { const response = await api.put(`/admin/payouts/${id}/status`, { status, notes }); return response.data; };

// Riders (driver_profiles on the backend)
export const getDriverVerifications = async () => { const response = await api.get('/admin/driver-verifications'); return response.data; };
export const getDriverVerificationDetails = async (id: string) => { const response = await api.get(`/admin/driver-verifications/${id}`); return response.data; };
export const approveDriverVerification = async (id: string) => { const response = await api.put(`/admin/driver-verifications/${id}/approve`); return response.data; };
export const rejectDriverVerification = async (id: string, reason: string) => { const response = await api.put(`/admin/driver-verifications/${id}/reject`, { reason }); return response.data; };

export const adminUpdateUserStatus = async (userId: string, status: 'active' | 'suspended' | 'banned', reason?: string) => {
  const response = await api.put(`/admin/users/${userId}/status`, { status, reason });
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
