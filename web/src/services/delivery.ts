import { api } from './client';

export const getDeliveryQuote = async () => ({});
export const getPublicFeeConfigs = async () => ({});
export const createDelivery = async () => ({});
export const getAvailableDeliveries = async () => {
  const response = await api.get('/delivery/available');
  return response.data;
};
export const assignDriver = async (deliveryId: string) => {
  const response = await api.put(`/delivery/${deliveryId}/assign`);
  return response.data;
};
export const getMyDeliveries = async () => {
  const response = await api.get('/delivery/my-deliveries');
  return response.data;
};
export const getDeliveryDetails = async (id: string) => {
  const response = await api.get(`/delivery/${id}`);
  return response.data;
};
export const updateDeliveryStatus = async (id: string, status: string) => {
  const response = await api.put(`/delivery/${id}/status`, { status });
  return response.data;
};
export const verifyDeliveryPin = async () => ({});
export const getActiveDeliveries = async () => {
  const response = await api.get('/delivery/active');
  return response.data;
};
export const getDriverStats = async (timeframe: string) => {
  const response = await api.get('/delivery/stats', { params: { timeframe } });
  return response.data;
};
export const updateDriverLocation = async () => ({});
export const getDriverProfile = async () => ({});
export const updateDriverAvailability = async () => ({});
export const submitDriverVerification = async () => ({});
