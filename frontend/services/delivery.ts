import { api, extractErrorMessage } from './client';

export const getDeliveryQuote = async (storeId: string, buyerLat?: number, buyerLng?: number, deliveryState?: string) => {
  try {
    const response = await api.get('/delivery/quote', { params: { storeId, buyerLat, buyerLng, deliveryState } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createDelivery = async (deliveryData: {
  orderId: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
}) => {
  try {
    const response = await api.post('/deliveries/create', deliveryData);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAvailableDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/available');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const assignDriver = async (deliveryId: string) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/assign`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyDeliveries = async (status?: string) => {
  try {
    const response = await api.get('/deliveries/my-deliveries', { params: { status } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDeliveryDetails = async (deliveryId: string) => {
  try {
    const response = await api.get(`/deliveries/${deliveryId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateDeliveryStatus = async (deliveryId: string, status: string) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const verifyDeliveryPin = async (deliveryId: string, pin: string) => {
  try {
    const response = await api.post(`/deliveries/${deliveryId}/verify-pin`, { pin });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || error.userMessage || extractErrorMessage(error));
  }
};

export const getActiveDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/active');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverStats = async (timeframe: 'today' | 'week' | 'month' = 'today') => {
  try {
    const response = await api.get('/deliveries/driver/stats', { params: { timeframe } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateDriverLocation = async (deliveryId: string, latitude: number, longitude: number) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/location`, { latitude, longitude });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverProfile = async () => {
  try {
    const response = await api.get('/deliveries/driver/profile');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateDriverAvailability = async (isAvailable: boolean) => {
  try {
    const response = await api.put('/deliveries/driver/availability', { isAvailable });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const submitDriverVerification = async (formData: FormData) => {
  try {
    const response = await api.post('/deliveries/verify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
