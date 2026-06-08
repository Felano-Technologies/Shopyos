import { api, extractErrorMessage } from './client';

export const getLoyaltyBalance = async (): Promise<{
  success: boolean;
  balance: number;
  lifetimeEarned: number;
  redeemableValue: number;
}> => {
  try {
    const response = await api.get('/loyalty/balance');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getLoyaltyTransactions = async (params: { limit?: number; offset?: number } = {}) => {
  try {
    const response = await api.get('/loyalty/transactions', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const validatePromoCode = async (
  code: string,
  subtotal: number
): Promise<{
  success: boolean;
  promo: {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    discountAmount: number;
    label: string;
  };
}> => {
  try {
    const response = await api.post('/promo/validate', { code, subtotal });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
