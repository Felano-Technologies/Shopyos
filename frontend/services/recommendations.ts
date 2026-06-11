import { api, extractErrorMessage } from './client';

export const getSimilarProducts = async (productId: string, limit = 10) => {
  try {
    const response = await api.get(`/products/${productId}/recommendations`, { params: { limit } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getPersonalizedRecommendations = async (limit = 10) => {
  try {
    const response = await api.get('/recommendations/personalized', { params: { limit } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getTrendingRecommendations = async (category?: string, limit = 10) => {
  try {
    const response = await api.get('/recommendations/trending', { params: { category, limit } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
