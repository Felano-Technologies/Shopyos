import { api, extractErrorMessage } from './client';

export const addToCart = async (productId: string, quantity: number, variantId?: string | null) => {
  try {
    const response = await api.post('/cart/add', { productId, quantity, variantId: variantId || undefined });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const clearBackendCart = async () => {
  try {
    const response = await api.delete('/cart/clear');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const createOrder = async (orderData: {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryCountry: string;
  deliveryPhone: string;
  deliveryNotes?: string;
  paymentMethod: string;
  paymentMethodId?: string | null;
  buyerLat?: number;
  buyerLng?: number;
  promoCode?: string;
  loyaltyPointsToRedeem?: number;
  requestLastMile?: boolean;
  lastMileFee?: number;
}) => {
  try {
    const response = await api.post('/orders/create', orderData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const confirmDelivery = async (orderId: string) => {
  try {
    const response = await api.put(`/orders/${orderId}/confirm-delivery`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyOrders = async (params: { status?: string; limit?: number; offset?: number } = {}) => {
  try {
    const response = await api.get('/orders/my-orders', { params });
    const res = response.data;
    return { ...res, orders: res.data || res.orders || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getStoreOrders = async (
  storeId: string,
  params: { status?: string; limit?: number; offset?: number } = {}
) => {
  try {
    const response = await api.get(`/orders/store/${storeId}`, { params });
    const res = response.data;
    return { ...res, orders: res.data || res.orders || [] };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch store orders');
    throw new Error(error.message || 'Network error fetching store orders');
  }
};

export const getOrderDetails = async (orderId: string) => {
  try {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch order details');
    throw new Error(error.message || 'Network error');
  }
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  try {
    const response = await api.put(`/orders/${orderId}/status`, { status });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update order status');
    throw new Error(error.message || 'Network error');
  }
};

export const cancelOrder = async (orderId: string, reason?: string) => {
  try {
    const response = await api.put(`/orders/${orderId}/cancel`, { reason });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to cancel order');
    throw new Error(error.message || 'Network error');
  }
};

export const addToFavorites = async (productId: string) => {
  try {
    const response = await api.post('/favorites', { productId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const removeFromFavorites = async (productId: string) => {
  try {
    const response = await api.delete(`/favorites/${productId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getFavorites = async () => {
  try {
    const response = await api.get('/favorites');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const checkIsFavorite = async (productId: string) => {
  try {
    const response = await api.get(`/favorites/check/${productId}`);
    return response.data;
  } catch {
    return { isFavorite: false };
  }
};

// ─── Return & Refund Requests ─────────────────────────────────────────────────

export const createReturnRequest = async (data: {
  orderId: string;
  reason: string;
  reasonCategory?: string;
  evidenceImages?: string[];
}) => {
  try {
    const response = await api.post('/returns', data);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyReturns = async (params: { page?: number; limit?: number } = {}) => {
  try {
    const response = await api.get('/returns/my', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getSellerReturns = async (params: { page?: number; limit?: number; status?: string } = {}) => {
  try {
    const response = await api.get('/returns/seller', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const respondToReturn = async (returnId: string, action: 'approve' | 'decline', sellerResponse?: string) => {
  try {
    const response = await api.patch(`/returns/${returnId}/respond`, { action, sellerResponse });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
