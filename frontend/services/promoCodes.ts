import { api, extractErrorMessage } from './client';

export interface PromoCodePayload {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrder?: number;
  maxUses?: number;
  expiresAt?: string;
}

export const createPromoCode = async (payload: PromoCodePayload) => {
  try {
    const response = await api.post('/promo-codes', payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyPromoCodes = async () => {
  try {
    const response = await api.get('/promo-codes/my-codes');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const deactivatePromoCode = async (id: string) => {
  try {
    const response = await api.patch(`/promo-codes/${id}/deactivate`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const adminCreatePromoCode = async (payload: PromoCodePayload) => {
  try {
    const response = await api.post('/promo-codes/admin', payload);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAdminPromoCodes = async (params: { storeId?: string; isActive?: boolean } = {}) => {
  try {
    const response = await api.get('/promo-codes/admin', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
