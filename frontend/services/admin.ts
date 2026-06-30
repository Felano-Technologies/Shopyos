import { api, extractErrorMessage } from './client';

export const getAdminPlatformSettings = async () => {
  try {
    const response = await api.get('/admin/platform-settings');
    return response.data.settings as { maintenance_mode: boolean; auto_approve_sellers: boolean };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateAdminPlatformSettings = async (updates: {
  maintenance_mode?: boolean;
  auto_approve_sellers?: boolean;
}) => {
  try {
    const response = await api.put('/admin/platform-settings', updates);
    return response.data.settings as { maintenance_mode: boolean; auto_approve_sellers: boolean };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

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

export const adminDeleteUser = async (userId: string) => {
  try {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminResetUserSession = async (userId: string) => {
  try {
    const response = await api.post(`/admin/users/${userId}/reset-session`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminDisableUserSession = async (userId: string) => {
  try {
    const response = await api.post(`/admin/users/${userId}/disable-session`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminCreateUser = async (data: {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  role: string;
}) => {
  try {
    const response = await api.post('/admin/users/create', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminCreateStore = async (data: Record<string, any>) => {
  try {
    const response = await api.post('/admin/stores/create', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminCreateDriver = async (data: Record<string, any>) => {
  try {
    const response = await api.post('/admin/drivers/create', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverStatsAdmin = async (driverId: string) => {
  try {
    const response = await api.get(`/admin/drivers/${driverId}/stats`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverHistoryAdmin = async (
  driverId: string,
  params: { limit?: number; offset?: number } = {}
) => {
  try {
    const response = await api.get(`/admin/drivers/${driverId}/deliveries`, { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminRevenueBreakdown = async (period: 'week' | 'month' | 'year' = 'month') => {
  try {
    const response = await api.get('/admin/revenue-breakdown', { params: { period } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminCreateCampaign = async (formData: FormData) => {
  try {
    const response = await api.post('/advertising/banners/admin-create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminAuditLogsFiltered = async (params: {
  limit?: number;
  offset?: number;
  role?: string;
  status?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
} = {}) => {
  try {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export interface PlatformFeeConfig {
  id: string;
  config_key: string;
  config_value: string;
  config_type: 'percentage' | 'fixed' | 'multiplier' | 'integer';
  category: 'commission' | 'delivery' | 'advertising' | 'payout' | 'bargaining' | 'buyer_protection' | 'flash_sale';
  label: string;
  description?: string;
  min_value?: string;
  max_value?: string;
  updated_at: string;
}

export const getAdminFeeConfigs = async (category?: string) => {
  try {
    const response = await api.get('/admin/fee-config', { params: { category } });
    return response.data.configs as PlatformFeeConfig[];
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateAdminFeeConfig = async (key: string, value: number, reason?: string) => {
  try {
    const response = await api.put(`/admin/fee-config/${key}`, { value, reason });
    return response.data.config as PlatformFeeConfig;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminFeeConfigAudit = async (key: string) => {
  try {
    const response = await api.get(`/admin/fee-config/audit/${key}`);
    return response.data.audit as Array<{
      id: string;
      config_key: string;
      old_value: string;
      new_value: string;
      changed_by: string;
      changed_by_email?: string;
      reason?: string;
      created_at: string;
    }>;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// ─── Hub Management ────────────────────────────────────────────────────────

export interface AdminHub {
  id: string;
  region_id: number;
  hub_name: string;
  partner_name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  region_name?: string;
  region_code?: string;
  created_at: string;
  updated_at: string;
}

export interface TransitRoute {
  id: string;
  origin_region: string;
  dest_region: string;
  transit_days_min: number;
  transit_days_max: number;
  transit_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const adminGetAllHubs = async () => {
  try {
    const response = await api.get('/admin/hubs');
    return response.data.data as AdminHub[];
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminCreateHub = async (payload: {
  regionId: number;
  hubName: string;
  partnerName: string;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}) => {
  try {
    const response = await api.post('/admin/hubs', payload);
    return response.data.hub as AdminHub;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminUpdateHub = async (
  hubId: string,
  payload: Partial<{
    hubName: string;
    partnerName: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  }>
) => {
  try {
    const response = await api.put(`/admin/hubs/${hubId}`, payload);
    return response.data.hub as AdminHub;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminToggleHub = async (hubId: string) => {
  try {
    const response = await api.patch(`/admin/hubs/${hubId}/toggle`);
    return response.data.hub as Pick<AdminHub, 'id' | 'hub_name' | 'is_active'>;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminGetTransitRoutes = async () => {
  try {
    const response = await api.get('/admin/transit-routes');
    return response.data.data as TransitRoute[];
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminUpsertTransitRoute = async (payload: {
  originRegion: string;
  destRegion: string;
  transitDaysMin: number;
  transitDaysMax: number;
  transitFee: number;
}) => {
  try {
    const response = await api.post('/admin/transit-routes', payload);
    return response.data.route as TransitRoute;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// ─── Disclaimer Management ──────────────────────────────────────────────────

export const adminUpdateDisclaimer = async (
  type: string,
  payload: { title: string; content: string; version: string }
) => {
  try {
    const response = await api.put(`/admin/disclaimers/${type}`, payload);
    return response.data.disclaimer;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminGetDisclaimerAudit = async (type?: string, limit?: number) => {
  try {
    const response = await api.get('/admin/disclaimers/audit', { params: { type, limit } });
    return response.data.audit as Array<{
      id: string;
      user_id: string;
      disclaimer_type: string;
      version: string;
      acknowledged_at: string;
      ip_address: string;
      context_type: string;
      context_id: string;
    }>;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// ─── Listing Fees ────────────────────────────────────────────────────────────

export const getAdminListingFees = async () => {
  try {
    const response = await api.get('/admin/listing-fees');
    return response.data.data as {
      summary: {
        total_stores: number;
        free_tier: number;
        paid_tier: number;
        approaching_limit: number;
        at_limit: number;
        free_limit: number;
        listing_fee_amount: number;
      };
      stores: Array<{
        id: string;
        name: string;
        owner_id: string;
        listing_tier: 'free' | 'paid';
        product_count: number;
        free_limit: number;
        listing_fee_paid_at: string | null;
        status: string;
      }>;
    };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
