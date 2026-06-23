import { api } from './client';

export const uploadStoreLogo = async () => ({});
export const businessRegister = async () => ({});
export const getMyBusinesses = async (params?: any) => {
  const response = await api.get('/business/my-businesses', { params });
  return response.data;
};
export const switchBusiness = async () => ({});
export const updateBusiness = async () => ({});
export const verifyBusinessDetails = async () => ({});
export const loginBusiness = async () => ({});
export const getBusinessById = async (id: string) => {
  const response = await api.get(`/business/${id}`);
  return response.data;
};
export const getAllStores = async () => {
  const response = await api.get('/business/stores');
  return response.data;
};
export const searchStores = async (query: string) => {
  const response = await api.get('/business/search', { params: { query } });
  return response.data;
};
export const getBusinessDashboard = async (id: string) => {
  const response = await api.get(`/business/${id}/dashboard`);
  return response.data;
};
export const getBusinessAnalytics = async (id: string, timeframe: string) => {
  const response = await api.get(`/business/${id}/analytics`, { params: { timeframe } });
  return response.data;
};
export const getBusinessReviews = async (id: string) => {
  const response = await api.get(`/reviews/store/${id}`);
  return response.data;
};
export const replyToReview = async (reviewId: string, responseText: string) => {
  const response = await api.post(`/reviews/${reviewId}/response`, { responseText });
  return response.data;
};
export const followStore = async (storeId: string) => {
  const response = await api.post(`/business/stores/${storeId}/follow`);
  return response.data;
};
export const unfollowStore = async (storeId: string) => {
  const response = await api.delete(`/business/stores/${storeId}/follow`);
  return response.data;
};
export const getDeliverySettings = async () => ({});
export const updateDeliverySettings = async () => ({});
