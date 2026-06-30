import { api, extractErrorMessage } from './client';

export const getBuyerAnalytics = async (month?: string) => {
  try {
    const response = await api.get('/buyers/analytics', { params: { month } });
    return response.data.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch analytics');
    throw new Error(error.message || 'Network error');
  }
};
