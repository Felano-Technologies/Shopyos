import { api, extractErrorMessage } from './client';

export const getStoreReviews = async (
  storeId: string,
  params: { limit?: number; offset?: number; rating?: number } = {}
) => {
  try {
    const response = await api.get(`/reviews/store/${storeId}`, { params });
    const res = response.data;
    return { ...res, reviews: res.data || res.reviews || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getProductReviews = async (
  productId: string,
  params: { limit?: number; offset?: number; rating?: number } = {}
) => {
  try {
    const response = await api.get(`/reviews/product/${productId}`, { params });
    const res = response.data;
    return { ...res, reviews: res.data || res.reviews || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createProductReview = async (reviewData: {
  productId: string;
  orderId?: string;
  rating: number;
  reviewText?: string;
}) => {
  try {
    const response = await api.post('/reviews/product', reviewData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createStoreReview = async (reviewData: {
  storeId: string;
  orderId?: string;
  rating: number;
  reviewText?: string;
}) => {
  try {
    const response = await api.post('/reviews/store', reviewData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createDriverReview = async (reviewData: {
  driverId: string;
  deliveryId: string;
  rating: number;
  reviewText?: string;
}) => {
  try {
    const response = await api.post('/reviews/driver', reviewData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getReviewableProducts = async () => {
  try {
    const response = await api.get('/reviews/reviewable-products');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const likeReview = async (reviewId: string) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/like`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getReviewComments = async (reviewId: string) => {
  try {
    const response = await api.get(`/reviews/${reviewId}/comments`);
    return {
      success: true,
      comments: response.data?.data || response.data?.comments || [],
    };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createReviewComment = async (reviewId: string, text: string) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/comments`, { text });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
