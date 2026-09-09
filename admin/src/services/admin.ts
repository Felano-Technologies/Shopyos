import { api } from './client';

export const getAdminDashboard = async () => { const response = await api.get('/admin/dashboard'); return response.data; };
export const getDashboardRevenueTrend = async (days = 14) => { const response = await api.get('/admin/dashboard/revenue-trend', { params: { days } }); return response.data; };
export const getDashboardUserGrowth = async (days = 14) => { const response = await api.get('/admin/dashboard/user-growth', { params: { days } }); return response.data; };
export const getAdminRevenueBreakdown = async (
  arg: 'week' | 'month' | 'year' | { period?: 'week' | 'month' | 'year'; from?: string; to?: string } = 'month'
) => {
  const params = typeof arg === 'string' ? { period: arg } : arg;
  const response = await api.get('/admin/revenue-breakdown', { params });
  return response.data;
};
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
export const adminDeleteStore = async (storeId: string) => {
  const response = await api.delete(`/admin/stores/${storeId}`);
  return response.data;
};
export const getAdminAuditLogs = async (params?: any) => { const response = await api.get('/admin/audit-logs', { params }); return response.data; };
export const getAdminVerifications = async (params?: any) => { const response = await api.get('/admin/verifications', { params }); return response.data; };
export const getAdminVerificationDetail = async (id: string) => { const response = await api.get(`/admin/verifications/${id}`); return response.data; };
export const approveVerification = async (id: string) => { const response = await api.put(`/admin/verifications/${id}/approve`); return response.data; };
export const rejectVerification = async (id: string, reason: string) => { const response = await api.put(`/admin/verifications/${id}/reject`, { reason }); return response.data; };
export const requestVerificationInformation = async (id: string, message: string, channel?: string) => { const response = await api.put(`/admin/verifications/${id}/request-information`, { message, channel }); return response.data; };
export const logVerificationNote = async (id: string, message: string, channel: string = 'phone_call') => { const response = await api.post(`/admin/verifications/${id}/notes`, { message, channel }); return response.data; };
export const assistedEditVerificationStep = async (id: string, stepKey: string, data: Record<string, any>, reason: string) => { const response = await api.patch(`/admin/verifications/${id}/steps/${stepKey}`, { data, reason }); return response.data; };
export const getAdminLocationChanges = async (params?: any) => { const response = await api.get('/admin/verifications/location-changes', { params }); return response.data; };
export const reviewLocationChange = async (id: string, status: 'verified' | 'rejected', reason?: string) => { const response = await api.put(`/admin/verifications/location-changes/${id}/review`, { status, reason }); return response.data; };
export const getAdminVehicleChanges = async (params?: any) => { const response = await api.get('/admin/verifications/vehicle-changes', { params }); return response.data; };
export const getLivenessFrameSignedUrl = async (attemptId: string, label: string) => { const response = await api.get(`/verification/liveness/${attemptId}/frames/${label}/signed-url`); return response.data; };
export const reviewVehicleChange = async (id: string, status: 'verified' | 'rejected', reason?: string) => { const response = await api.put(`/admin/verifications/vehicle-changes/${id}/review`, { status, reason }); return response.data; };
export const getAdminOrders = async (params?: any) => { const response = await api.get('/admin/orders', { params }); return response.data; };
export const getAdminOrderStats = async () => { const response = await api.get('/admin/orders/stats'); return response.data; };
export const updateOrderStatus = async (orderId: string, status: string) => {
  const response = await api.put(`/orders/${orderId}/status`, { status });
  return response.data;
};

// Deliveries (dispatch/logistics — distinct from the order itself)
export const getAdminDeliveries = async (params?: any) => { const response = await api.get('/admin/deliveries', { params }); return response.data; };
export const getAdminDeliveryStats = async () => { const response = await api.get('/admin/deliveries/stats'); return response.data; };

// Escrow (funds held pending manual admin resolution — orders.escrow_status)
export const getAdminEscrows = async (params?: any) => { const response = await api.get('/admin/escrows', { params }); return response.data; };
export const getAdminEscrowStats = async () => { const response = await api.get('/admin/escrows/stats'); return response.data; };
export const refundEscrow = async (id: string, reason?: string) => { const response = await api.put(`/admin/escrows/${id}/refund`, { reason }); return response.data; };
export const releaseEscrow = async (id: string, reason?: string) => { const response = await api.put(`/admin/escrows/${id}/release`, { reason }); return response.data; };

// Revenue
export const getAdminRevenue = async (params?: { limit?: number; offset?: number }) => { const response = await api.get('/admin/revenue', { params }); return response.data; };

// In-app calls — audit/dispute review (recorded calls, playback)
export const getAdminCalls = async (params?: { status?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
  const response = await api.get('/admin/calls', { params });
  return response.data;
};
export const getAdminCallDetails = async (id: string) => {
  const response = await api.get(`/admin/calls/${id}`);
  return response.data;
};

// Financial Dashboard — Profit & Loss (revenue vs. configurable expenses)
export const getFinancialSummary = async (params?: { from?: string; to?: string }) => { const response = await api.get('/admin/financial-summary', { params }); return response.data; };

export const getExpenseCategories = async (activeOnly?: boolean) => { const response = await api.get('/admin/expense-categories', { params: activeOnly ? { activeOnly: 'true' } : undefined }); return response.data; };
export const createExpenseCategory = async (data: { name: string; description?: string }) => { const response = await api.post('/admin/expense-categories', data); return response.data; };
export const updateExpenseCategory = async (id: string, data: { name: string; description?: string }) => { const response = await api.put(`/admin/expense-categories/${id}`, data); return response.data; };
export const toggleExpenseCategory = async (id: string) => { const response = await api.patch(`/admin/expense-categories/${id}/toggle`); return response.data; };

export const getExpenses = async (params?: { categoryId?: string; from?: string; to?: string; limit?: number; offset?: number }) => { const response = await api.get('/admin/expenses', { params }); return response.data; };
export const createExpense = async (data: {
  categoryId: string; amount: number; description?: string; expenseDate: string;
  isRecurring?: boolean; recurrenceFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'; recurrenceEndDate?: string;
}) => { const response = await api.post('/admin/expenses', data); return response.data; };
export const updateExpense = async (id: string, data: {
  categoryId: string; amount: number; description?: string; expenseDate: string;
  isRecurring?: boolean; recurrenceFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'; recurrenceEndDate?: string;
}) => { const response = await api.put(`/admin/expenses/${id}`, data); return response.data; };
export const deleteExpense = async (id: string) => { const response = await api.delete(`/admin/expenses/${id}`); return response.data; };

// Payouts — the real seller+driver payout pipeline (Paystack transfers, balance refunds).
// Lives under /payouts, not /admin/payouts: that legacy admin route only flips a status
// column with no Paystack integration, so "completing" a payout there would never move money.
export const getAdminPayoutList = async (params?: {
  type?: 'seller' | 'driver' | 'hub'; status?: string; search?: string; from?: string; to?: string; page?: number; limit?: number;
}) => {
  const response = await api.get('/payouts/admin/all', { params });
  return response.data;
};
export const getAdminPayoutSummary = async () => {
  const response = await api.get('/payouts/admin/summary');
  return response.data;
};
export const processAdminPayout = async (payoutId: string, action: 'approve' | 'reject') => {
  const response = await api.put(`/payouts/${payoutId}/process`, { action });
  return response.data;
};
export const bulkProcessPayouts = async (ids: string[], action: 'approve' | 'reject') => {
  const response = await api.post('/payouts/admin/bulk-process', { ids, action });
  return response.data;
};

// Riders (driver_profiles on the backend)
export const getDriverVerifications = async (params?: { search?: string; status?: string }) => { const response = await api.get('/admin/driver-verifications', { params }); return response.data; };
export const getDriverVerificationDetails = async (id: string) => { const response = await api.get(`/admin/driver-verifications/${id}`); return response.data; };
export const approveDriverVerification = async (id: string) => { const response = await api.put(`/admin/driver-verifications/${id}/approve`); return response.data; };
export const rejectDriverVerification = async (id: string, reason: string) => { const response = await api.put(`/admin/driver-verifications/${id}/reject`, { reason }); return response.data; };

export const adminUpdateUserStatus = async (userId: string, status: 'active' | 'suspended' | 'banned', reason?: string) => {
  const response = await api.put(`/admin/users/${userId}/status`, { status, reason });
  return response.data;
};
export const adminDeleteUser = async (userId: string) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
};
export const adminUpdateUserRole = async (userId: string, role: 'buyer' | 'seller' | 'driver' | 'parcel_partner' | 'admin') => {
  const response = await api.put(`/admin/users/${userId}/role`, { role });
  return response.data;
};

// Configs (platform_fee_config — keyed by config_key, not id)
export const getAdminFeeConfigs = async (category?: string) => {
  const response = await api.get('/admin/fee-config', { params: category ? { category } : {} });
  return response.data;
};
export const updateAdminFeeConfig = async (key: string, value: number, reason?: string) => {
  const response = await api.put(`/admin/fee-config/${key}`, { value, reason });
  return response.data;
};
export const getAdminFeeConfigAudit = async (key: string) => {
  const response = await api.get(`/admin/fee-config/audit/${key}`);
  return response.data;
};

// Disclaimers — a fixed catalog of legal document types (no create/delete; content is versioned in-place)
export const getAdminDisclaimers = async () => {
  const response = await api.get('/admin/disclaimers');
  return response.data;
};
export const updateAdminDisclaimer = async (type: string, data: { title: string; content: string; version: string }) => {
  const response = await api.put(`/admin/disclaimers/${type}`, data);
  return response.data;
};
export const getAdminDisclaimerAudit = async (type?: string, limit = 50) => {
  const response = await api.get('/admin/disclaimers/audit', { params: { type, limit } });
  return response.data;
};

// Banner Ads (advertising/banners — NOT under /admin, lives on the advertising router)
export const getAdminBannerCampaigns = async () => {
  const response = await api.get('/advertising/banners/all');
  return response.data;
};
export const updateAdminBannerCampaignStatus = async (id: string, status: 'Approved' | 'Rejected' | 'Active' | 'Completed', reason?: string) => {
  const response = await api.put(`/advertising/banners/${id}/status`, { status, reason });
  return response.data;
};

// Ghana Regions (lookup for hub / transit-route forms)
export const getAdminRegions = async () => { const response = await api.get('/admin/regions'); return response.data; };

// Hubs (parcel_partner_hubs — region_id, hub_name, partner_name, address, phone)
export const adminGetAllHubs = async () => { const response = await api.get('/admin/hubs'); return response.data; };
export const adminCreateHub = async (data: {
  regionId: number; hubName: string; partnerName: string; address?: string; phone?: string; latitude?: number; longitude?: number; ownerId?: string;
}) => {
  const response = await api.post('/admin/hubs', data);
  return response.data;
};
export const adminUpdateHub = async (id: string, data: {
  hubName?: string; partnerName?: string; address?: string; phone?: string; latitude?: number; longitude?: number; ownerId?: string;
}) => {
  const response = await api.put(`/admin/hubs/${id}`, data);
  return response.data;
};
export const adminToggleHub = async (id: string) => { const response = await api.patch(`/admin/hubs/${id}/toggle`); return response.data; };

// Transit Routes (parcel_transit_config — region-to-region, not hub-to-hub)
export const adminGetTransitRoutes = async () => { const response = await api.get('/admin/transit-routes'); return response.data; };
export const adminUpsertTransitRoute = async (data: {
  originRegion: string; destRegion: string; transitDaysMin: number; transitDaysMax: number; transitFee: number;
}) => {
  const response = await api.post('/admin/transit-routes', data);
  return response.data;
};

// Settings
export const getAdminPlatformSettings = async () => { const response = await api.get('/admin/settings'); return response.data; };
export const updateAdminPlatformSettings = async (updates: any) => { const response = await api.put('/admin/settings', updates); return response.data; };
