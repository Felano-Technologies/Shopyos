import { api, extractErrorMessage } from './client';

interface InitializePaymentParams {
  orderId: string;
  email?: string;
  channel?: 'mobile_money' | 'card';
  momoPhone?: string;
  momoProvider?: 'mtn' | 'vod' | 'tgo';
  callbackUrl?: string;
}

export const initializePayment = async (params: InitializePaymentParams) => {
  try {
    const response = await api.post('/payments/initialize', params);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    return { success: false, error: error.message || 'Failed to initialize payment' };
  }
};

export const verifyPayment = async (reference: string) => {
  try {
    const response = await api.get(`/payments/verify/${reference}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    return { success: false, error: error.message || 'Failed to verify payment' };
  }
};

export const getPaymentMethods = async () => {
  try {
    const response = await api.get('/payment-methods');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const addPaymentMethod = async (methodData: {
  type: 'card' | 'momo';
  provider: string;
  title: string;
  identifier: string;
  is_default?: boolean;
}) => {
  try {
    const response = await api.post('/payment-methods', methodData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deletePaymentMethod = async (id: string) => {
  try {
    const response = await api.delete(`/payment-methods/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const setDefaultPaymentMethod = async (id: string) => {
  try {
    const response = await api.put(`/payment-methods/${id}/default`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getPayoutHistory = async (storeId: string) => {
  try {
    const response = await api.get(`/payouts/history/${storeId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const requestPayout = async (payoutData: any) => {
  try {
    const response = await api.post('/payouts/request', payoutData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getSellerLockedBalance = async (storeId: string) => {
  try {
    const response = await api.get(`/payouts/locked/${storeId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const requestDriverPayout = async (amount: number) => {
  try {
    const response = await api.post('/payouts/driver-request', { amount });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverPayoutHistory = async (params?: { status?: string; from?: string; to?: string }) => {
  try {
    const response = await api.get('/payouts/driver-history', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminPayoutList = async (params?: {
  type?: 'seller' | 'driver';
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
}) => {
  try {
    const response = await api.get('/payouts/admin/all', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminPayoutSummary = async () => {
  try {
    const response = await api.get('/payouts/admin/summary');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const bulkProcessPayouts = async (ids: string[], action: 'approve' | 'reject') => {
  try {
    const response = await api.post('/payouts/admin/bulk-process', { ids, action });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const processAdminPayout = async (payoutId: string, action: 'approve' | 'reject') => {
  try {
    const response = await api.put(`/payouts/${payoutId}/process`, { action });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateDriverPayoutMethod = async (data: {
  payout_method: 'bank' | 'mobile_money';
  payout_details: Record<string, string>;
}) => {
  try {
    const response = await api.patch('/users/profile', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const initializeListingFee = async (payload: { storeId: string; email: string; channel?: string }) => {
  try {
    const response = await api.post('/payments/listing-fee/initialize', payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const initializeBannerPayment = async (payload: { campaignId: string; email: string; callbackUrl?: string }) => {
  try {
    const response = await api.post('/advertising/banners/pay-initialize', payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const verifyBannerPayment = async (reference: string) => {
  try {
    const response = await api.get(`/advertising/banners/verify/${reference}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
