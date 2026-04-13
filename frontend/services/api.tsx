import axios from 'axios';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { queryClient } from '@/lib/query/client';
import { socketService } from './socket';
import { CustomInAppToast } from "@/components/InAppToastHost";
export { CustomInAppToast };

// Dynamic baseURL based on platform and environment
const getBaseURL = () => {
  const isDev = __DEV__ ? "development" : "production";
  if (isDev === "development") {
    // Development mode - use local server
    if (Platform.OS === 'android') {
      return 'https://dios-mnxg.onrender.com'; // Android Emulator http://10.0.2.2:5000
    } else {
      return 'https://dios-mnxg.onrender.com'; // iOS Simulator and Web http://localhost:5000
    }
  } else {
    // Production mode - use production server
    return 'https://dios-mnxg.onrender.com';
  }
};

export const baseURL = getBaseURL();
export const API_URL = `${baseURL}/api/v1/`;

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return await AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await AsyncStorage.removeItem(key);
  },
};

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
 
// ─── Error message extractor ──────────────────────────────────────────────────
export const extractErrorMessage = (error: any): string => {
  if (error?.response) {
    const { status, data } = error.response;
    const serverMsg = data?.error || data?.message;
    if (serverMsg && typeof serverMsg === 'string' && serverMsg !== 'Internal Server Error') {
      return serverMsg;
    }
    switch (status) {
      case 400: return serverMsg || 'Invalid request. Please check your input and try again.';
      case 401: return 'Your session has expired. Please log in again.';
      case 403: return serverMsg || "You don't have permission to perform this action.";
      case 404: return serverMsg || 'The requested resource was not found.';
      case 408: return 'Request timed out. Please check your connection and try again.';
      case 409: return serverMsg || 'This action conflicts with existing data.';
      case 413: return 'The file you uploaded is too large. Please try a smaller file.';
      case 422: return serverMsg || 'Please check your input — some fields are invalid.';
      case 429: return 'Too many requests. Please wait a moment and try again.';
      case 500: return 'Server error. Please try again later.';
      case 502: return 'Server is temporarily unreachable. Please try again in a moment.';
      case 503: return 'Service is temporarily unavailable. Please try again later.';
      default: return serverMsg || `Something went wrong (error ${status}). Please try again.`;
    }
  }
  if (error?.request) {
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please check your internet connection.';
    return 'No internet connection. Please check your network and try again.';
  }
  if (error?.message) {
    if (error.message.includes('Network Error')) return 'No internet connection. Please check your network and try again.';
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};
 
// ─── FIX 2: 429 exponential backoff helper ────────────────────────────────────
// Waits for the delay indicated by Retry-After header (seconds) if present,
// otherwise uses exponential backoff: attempt 0→1s, 1→2s, 2→4s.
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
 
const get429DelayMs = (error: any, attempt: number): number => {
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  // Exponential backoff: 1s, 2s, 4s
  return Math.pow(2, attempt) * 1000;
};
 
// ─── Axios instance ───────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);
 
// ─── Token refresh queue ──────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];
 
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};
 
// ─── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    error.userMessage = extractErrorMessage(error);
 
    const originalRequest = error.config;
 
    // ── FIX 2: Handle 429 rate limiting with exponential backoff ──────────────
    if (error.response?.status === 429) {
      // Track retry count on the request config object
      originalRequest._429RetryCount = (originalRequest._429RetryCount ?? 0);
 
      const MAX_429_RETRIES = 3;
 
      if (originalRequest._429RetryCount < MAX_429_RETRIES) {
        const attempt = originalRequest._429RetryCount;
        originalRequest._429RetryCount += 1;
 
        const delayMs = get429DelayMs(error, attempt);
        console.warn(`[429] Rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_429_RETRIES})`);
 
        await wait(delayMs);
        return api(originalRequest);
      }
 
      // Exhausted retries — show Toast and reject
      CustomInAppToast.show({
        type: 'error',
        title: 'Too many requests',
        message: 'Please slow down and try again in a moment.',
      });
 
      return Promise.reject(error);
    }
 
    // ── Handle 401 token expiry with silent refresh ───────────────────────────
    const isTokenExpired =
      error.response?.status === 401 &&
      (error.response?.data?.code === 'TOKEN_EXPIRED' ||
        error.response?.data?.error === 'Access token expired');
 
    if (isTokenExpired && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }
 
      originalRequest._retry = true;
      isRefreshing = true;
 
      try {
        const storedRefreshToken = await secureStorage.getItem('refreshToken');
        if (!storedRefreshToken) throw new Error('No refresh token stored');
 
        const refreshRes = await api.post('/auth/refresh', {
          refreshToken: storedRefreshToken,
        });
        const { token: newAccessToken, refreshToken: newRefreshToken } = refreshRes.data;
 
        await secureStorage.setItem('userToken', newAccessToken);
        if (newRefreshToken) await secureStorage.setItem('refreshToken', newRefreshToken);
 
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
 
        // FIX 4: Also update the socket auth token so it doesn't stay stale
        // after a silent refresh. Socket will re-authenticate on next emit.
        try {
          const sock = socketService.getSocket();
          if (sock) {
            sock.auth = { token: newAccessToken };
          }
        } catch (_) {}
 
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        try {
          await secureStorage.removeItem('userToken');
          await secureStorage.removeItem('refreshToken');
          await storage.removeItem('userId');
        } catch (_) {}
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    // ── Non-expiry 401: clear storage ─────────────────────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      try {
        // Check if token existed before clearing — helps prevent double redirects during manual logout
        const existingToken = await secureStorage.getItem('userToken');
        
        await secureStorage.removeItem('userToken');
        await secureStorage.removeItem('refreshToken');
        await storage.removeItem('userId');

        // Only force redirect if we haven't already cleared the session manually
        if (existingToken) {
          try {
            const { router } = require('expo-router');
            if (router) {
              router.replace('/login');
            }
          } catch (e) {}
        }
      } catch (storageError) {
        console.error('Error clearing tokens:', storageError);
      }
    }
 
    return Promise.reject(error);
  }
);
 
// ─── Auth ─────────────────────────────────────────────────────────────────────
 
export const registerUser = async (
  name: string,
  email: string,
  password: string,
  fullPhoneNumber: string
) => {
  try {
    const response = await api.post('/auth/register', {
      name, email, fullPhoneNumber, password,
    });
    if (response.data.token) {
      await secureStorage.setItem('userToken', response.data.token);
      if (response.data.refreshToken) {
        await secureStorage.setItem('refreshToken', response.data.refreshToken);
      }
    }
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Registration failed');
    throw new Error(error.message || 'Network error during registration');
  }
};
 
export const registerPushTokenInBackend = async (token: string) => {
  try {
    const response = await api.post('/notifications/push-token', {
      token, deviceName: 'Mobile App',
    });
    return response.data;
  } catch (err: any) {
    console.warn('Failed to sync push token with backend:', err.message);
    throw err;
  }
};
 
export const requestPasswordReset = async (email: string) => {
  try {
    const response = await api.post('/auth/reset-password', { email });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const confirmResetPassword = async (token: string, newPassword: string) => {
  try {
    const response = await api.post('/auth/reset-password/confirm', { token, newPassword });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.error) throw new Error(error.response.data.error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const logoutUser = async () => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Error calling logout API:', error);
  } finally {
    queryClient.clear();
    await storage.removeItem('SHOPYOS_QUERY_CACHE');
    await Promise.all([
      secureStorage.removeItem('userToken'),
      secureStorage.removeItem('refreshToken'),
      secureStorage.removeItem('businessToken'),
      storage.removeItem('userId'),
      storage.removeItem('currentBusinessId'),
      storage.removeItem('currentBusinessVerificationStatus'),
      storage.removeItem('userRole'),
      storage.removeItem('cart'),
    ]);
    socketService.disconnect();
  }
};
 
export const loginUser = async (
  email: string,
  password: string,
  latitude: number,
  longitude: number
) => {
  try {
    const response = await api.post('/auth/login', {
      email, password, latitude, longitude,
    });
 
    if (response.data.token) {
      await secureStorage.setItem('userToken', response.data.token);
      if (response.data.refreshToken) {
        await secureStorage.setItem('refreshToken', response.data.refreshToken);
      }
      try {
        const meResponse = await api.get('/auth/me');
        if (meResponse.data?.id) {
          await storage.setItem('userId', meResponse.data.id);
        }
      } catch (meErr) {
        console.warn('Could not fetch userId after login:', meErr);
      }
      try {
        const pushToken = await storage.getItem('expoPushToken');
        if (pushToken) await registerPushTokenInBackend(pushToken);
      } catch (err) {
        console.warn('Failed syncing expo push token on login:', err);
      }
    }
 
    const needsRole =
      response.data.requiresRoleSelection ||
      response.data.role === 'none' ||
      !response.data.role ||
      (response.data.roles && response.data.roles.length === 0);
 
    return { ...response.data, needsRole };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Login failed');
    throw new Error(error.message || 'Network error during login');
  }
};
 
export const getUserData = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch user data');
    throw new Error(error.message || 'Network error fetching user data');
  }
};
 
export const updateProfile = async (profileData: {
  name?: string;
  phone?: string;
  avatar_url?: string;
  country?: string;
  state_province?: string;
  city?: string;
  address_line1?: string;
}) => {
  try {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update profile');
    throw new Error(error.message || 'Network error updating profile');
  }
};
 
export const updateUserRole = async (role: string) => {
  try {
    const response = await api.post('/auth/add-role', { role });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update role');
    throw new Error(error.message || 'Network error during role update');
  }
};

export const updateOnboardingState = async (screen: string, completed: boolean = true) => {
  try {
    const response = await api.put('/auth/onboarding', { screen, completed });
    return response.data;
  } catch (error: any) {
    console.error('Failed to update onboarding state:', error);
    return null;
  }
};

// ─── Uploads ───────────────────────────────────────────────────────────────────

export const uploadAvatar = async (uri: string) => {
  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : `image/jpeg`;

    formData.append('avatar', { uri, name: filename, type } as any);

    const response = await api.post('/upload/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to upload avatar');
    throw new Error(error.message || 'Network error during avatar upload');
  }
};

export const uploadStoreLogo = async (uri: string) => {
  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'logo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1] === 'jpg' ? 'jpeg' : match[1]}` : `image/jpeg`;

    formData.append('logo', { uri, name: filename, type } as any);

    const response = await api.post('/upload/store-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to upload store logo');
    throw new Error(error.message || 'Network error during logo upload');
  }
};
 
export const businessRegister = async (businessData: any) => {
  try {
    const formData = new FormData();
    Object.keys(businessData).forEach(key => {
      if (businessData[key] !== undefined && businessData[key] !== null) {
        if (typeof businessData[key] === 'string' && businessData[key].startsWith('file://')) {
          const uri = businessData[key];
          const filename = uri.split('/').pop() || 'upload.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          formData.append(key, { uri, name: filename, type } as any);
        } else {
          formData.append(key, businessData[key]);
        }
      }
    });

    const response = await api.post('/business/create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (response.data.token) await secureStorage.setItem('businessToken', response.data.token);
    if (response.data.business?._id) {
      await storage.setItem('currentBusinessId', response.data.business._id);
    }
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to create business');
    throw new Error(error.message || 'Network error during business creation');
  }
};
 
export const getMyBusinesses = async (params: { limit?: number; offset?: number } = {}) => {
  try {
    const response = await api.get('/business/my-businesses', { params });
    const res = response.data;
    return { ...res, businesses: res.data || res.businesses || [] };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch businesses');
    throw new Error(error.message || 'Network error fetching businesses');
  }
};
 
export const switchBusiness = async (businessId: string) => {
  try {
    const response = await api.post('/business/switch', { businessId });
    if (response.data.token) await secureStorage.setItem('businessToken', response.data.token);
    await storage.setItem('currentBusinessId', businessId);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to switch business');
    throw new Error(error.message || 'Network error switching business');
  }
};
 
export const updateBusiness = async (businessId: string, updateData: any) => {
  try {
    const formData = new FormData();
    let hasFiles = false;
    const isLocalFileUri = (value: string) => /^(file|content|ph|assets-library):\/\//i.test(value);

    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      if (value !== undefined && value !== null) {
        if (typeof value === 'string' && isLocalFileUri(value)) {
          const uri = value;
          const name = uri.split('/').pop() || 'upload.jpg';
          const match = /\.(\w+)$/.exec(name);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          formData.append(key, { uri, name, type } as any);
          hasFiles = true;
        } else {
          formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
      }
    });

    const config = hasFiles ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.put(`/business/update/${businessId}`, hasFiles ? formData : updateData, config);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update business');
    throw new Error(error.message || 'Network error updating business');
  }
};
 
export const verifyBusinessDetails = async (businessId: string, details: any) => {
  return await updateBusiness(businessId, {
    ...details,
    verificationStatus: 'pending',
  });
};










 
// ─── Cart ─────────────────────────────────────────────────────────────────────
 
export const addToCart = async (productId: string, quantity: number) => {
  try {
    const response = await api.post('/cart/add', { productId, quantity });
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
  deliveryCountry: string;
  deliveryPhone: string;
  deliveryNotes?: string;
  paymentMethod: string;
  paymentMethodId?: string | null;
}) => {
  try {
    const response = await api.post('/orders/create', orderData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getMyOrders = async (
  params: { status?: string; limit?: number; offset?: number } = {}
) => {
  try {
    const response = await api.get('/orders/my-orders', { params });
    const res = response.data;
    return { ...res, orders: res.data || res.orders || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAllStores = async (
  params: {
    search?: string;
    category?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
    verified?: string;
  } = {}
) => {
  try {
    const response = await api.get('/business/all', { params });
    const res = response.data;
    return { ...res, businesses: res.data || res.businesses || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getBusinessById = async (id: string) => {
  try {
    const response = await api.get(`/business/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Favorites ────────────────────────────────────────────────────────────────
 
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
  } catch (error: any) {
    return { isFavorite: false };
  }
};
 
// ─── Store orders ─────────────────────────────────────────────────────────────
 
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
 
export const getStoreProducts = async (storeId: string, params: any = {}) => {
  try {
    const response = await api.get(`/products/store/${storeId}`, { params });
    const res = response.data;
    return { ...res, products: res.data || res.products || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const searchProducts = async (params: {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  minPrice?: number;
  maxPrice?: number;
}) => {
  try {
    const response = await api.get('/products/search', { params });
    const res = response.data;
    return { ...res, products: res.data || res.products || [] };
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAllCategories = async () => {
  try {
    const response = await api.get('/categories');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Categories management ────────────────────────────────────────────────────
 
export const createCategory = async (name: string, description?: string) => {
  try {
    const response = await api.post('/categories', { name, description });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to create category');
    throw error;
  }
};
 
export const updateCategory = async (id: string, name: string) => {
  try {
    const response = await api.put(`/categories/${id}`, { name });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update category');
    throw error;
  }
};
 
export const deleteCategory = async (id: string, force: boolean = false) => {
  try {
    const response = await api.delete(`/categories/${id}?force=${force}`);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      if (error.response.data.requiresConfirmation) throw error.response.data;
      throw new Error(error.response.data.error || 'Failed to delete category');
    }
    throw error;
  }
};
 
export const getProductById = async (id: string) => {
  try {
    const response = await api.get(`/products/${id}`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
};
 
export const createProduct = async (productData: any) => {
  try {
    const response = await api.post('/products', productData);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to create product');
    throw error;
  }
};
 
// ─── FIX 5: deleteProduct now invalidates React Query cache ──────────────────
// Previously this just called the API. The product detail and store product
// list queries would serve stale (deleted) data until gcTime expired.
// Now we invalidate both query keys immediately after a successful delete,
// and also remove the specific detail entry so no screen can still render it.
export const deleteProduct = async (productId: string, storeId?: string) => {
  try {
    const response = await api.delete(`/products/${productId}`);
 
    // Invalidate the deleted product's detail cache
    queryClient.removeQueries({ queryKey: ['products', 'detail', productId] });
 
    // Invalidate the store's product list so the item disappears from listings
    if (storeId) {
      queryClient.invalidateQueries({ queryKey: ['business', 'products', storeId] });
    }
 
    // Invalidate all product list/search caches — the item may appear there too
    queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
 
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to delete product');
    throw error;
  }
};
 
export const updateProduct = async (productId: string, productData: any) => {
  try {
    const response = await api.put(`/products/${productId}`, productData);
 
    // FIX 5: Invalidate caches after update too — same reasoning as delete
    queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
    queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
 
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to update product');
    throw error;
  }
};
 
export const uploadProductImages = async (productId: string, imageUris: string[]) => {
  try {
    const formData = new FormData();
    imageUris.forEach((uri) => {
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image';
      // @ts-ignore
      formData.append('images', { uri, name: filename, type });
    });
    const response = await api.post(`/products/${productId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // Invalidate product detail so updated images are reflected immediately
    queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getBusinessDashboard = async (businessId: string) => {
  try {
    const response = await api.get(`/business/dashboard/${businessId}`);
    return response.data.data || response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch dashboard data');
    throw new Error(error.message || 'Network error fetching dashboard');
  }
};
 
export const getBusinessAnalytics = async (
  businessId: string,
  timeframe: 'week' | 'month' | 'year'
) => {
  try {
    const response = await api.get(
      `/business/analytics/${businessId}?timeframe=${timeframe}`
    );
    return response.data.data || response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch analytics');
    throw new Error(error.message || 'Network error');
  }
};

export const getBusinessReviews = async (businessId: string) => {
  try {
    const response = await api.get(`/business/${businessId}/reviews`);
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to fetch business reviews');
    throw new Error(error.message || 'Network error fetching business reviews');
  }
};

export const replyToReview = async (reviewId: string, text: string) => {
  try {
    const response = await api.post(`/reviews/${reviewId}/comments`, { text });
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to post reply');
    throw new Error(error.message || 'Network error posting reply');
  }
};
 
export const loginBusiness = async (
  email: string,
  password: string,
  latitude: number,
  longitude: number
) => {
  try {
    const response = await api.post('/business/login', {
      email, password, latitude, longitude,
    });
    if (response.data.token) {
      await secureStorage.setItem('businessToken', response.data.token);
      await secureStorage.setItem('userToken', response.data.token); // Synchronize for interceptor
    }
    if (response.data.business) {
      await storage.setItem('currentBusinessId', response.data.business._id);
      await storage.setItem('userRole', 'seller');
    }
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Business login failed');
    throw new Error(error.message || 'Network error during business login');
  }
};
 
// ─── Messaging ────────────────────────────────────────────────────────────────
 
export const getConversations = async () => {
  try {
    const response = await api.get('/messaging/conversations');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getMessages = async (conversationId: string) => {
  try {
    const response = await api.get(
      `/messaging/conversations/${conversationId}/messages`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const sendMessage = async (conversationId: string, content: string) => {
  try {
    const response = await api.post(
      `/messaging/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const markConversationRead = async (conversationId: string) => {
  try {
    const response = await api.put(
      `/messaging/conversations/${conversationId}/read`
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const startConversation = async (participantId: string) => {
  try {
    const response = await api.post('/messaging/conversations', { participantId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const deleteMessage = async (messageId: string) => {
  try {
    const response = await api.delete(`/messaging/messages/${messageId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const deleteConversation = async (conversationId: string) => {
  try {
    const response = await api.delete(`/messaging/conversations/${conversationId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Reviews ──────────────────────────────────────────────────────────────────
 
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
 
// ─── Advertising ──────────────────────────────────────────────────────────────
 
export const getPromotedProducts = async (category?: string) => {
  try {
    const response = await api.get('/advertising/promoted', { params: { category } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const createCampaign = async (campaignData: any) => {
  try {
    const response = await api.post('/advertising/campaigns', campaignData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getMyCampaigns = async () => {
  try {
    const response = await api.get('/advertising/my-campaigns');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const updateCampaignStatus = async (id: string, status: string) => {
  try {
    const response = await api.put(`/advertising/campaigns/${id}/status`, { status });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const recordAdClick = async (id: string) => {
  try {
    const response = await api.post(`/advertising/campaigns/${id}/click`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Payouts ──────────────────────────────────────────────────────────────────
 
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
 
// ─── Notifications ────────────────────────────────────────────────────────────
 
export const getNotifications = async () => {
  try {
    const response = await api.get('/notifications');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const markNotificationRead = async (notificationId: string) => {
  try {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const markAllNotificationsRead = async () => {
  try {
    const response = await api.put('/notifications/read-all');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getUnreadNotificationCount = async () => {
  try {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getNotificationPreferences = async () => {
  try {
    const response = await api.get('/notifications/preferences');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const updateNotificationPreferences = async (preferences: any) => {
  try {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Payment methods ──────────────────────────────────────────────────────────
 
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
 
// ─── Delivery ─────────────────────────────────────────────────────────────────
 
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
 
export const getActiveDeliveries = async () => {
  try {
    const response = await api.get('/deliveries/active');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getDriverStats = async (
  timeframe: 'today' | 'week' | 'month' = 'today'
) => {
  try {
    const response = await api.get('/deliveries/driver/stats', {
      params: { timeframe },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Reviews ──────────────────────────────────────────────────────────────────
 
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
  orderId: string;
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
 
// ─── Admin ────────────────────────────────────────────────────────────────────
 
export const getAdminDashboard = async () => {
  try {
    const response = await api.get('/admin/dashboard');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAdminUsers = async (params = {}) => {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAdminStores = async (params = {}) => {
  try {
    const response = await api.get('/admin/stores', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const adminVerifyStore = async (
  storeId: string,
  status: 'verified' | 'rejected' | 'pending',
  reason?: string
) => {
  try {
    const response = await api.put(`/admin/stores/${storeId}/verify`, {
      status, reason,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAdminAuditLogs = async (
  params: {
    limit?: number;
    offset?: number;
    action?: string;
    entityType?: string;
  } = {}
) => {
  try {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAdminOrders = async (
  params: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) => {
  try {
    const response = await api.get('/admin/orders', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAdminRevenue = async (
  params: { limit?: number; offset?: number } = {}
) => {
  try {
    const response = await api.get('/admin/revenue', { params });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const adminUpdateUserStatus = async (
  userId: string,
  status: 'active' | 'suspended' | 'banned',
  reason?: string
) => {
  try {
    const response = await api.put(`/admin/users/${userId}/status`, {
      status, reason,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const getAdminPayouts = async (status?: string) => {
  try {
    const response = await api.get('/admin/payouts', { params: { status } });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const updateAdminPayoutStatus = async (
  payoutId: string,
  status: 'completed' | 'rejected',
  notes?: string
) => {
  try {
    const response = await api.put(`/admin/payouts/${payoutId}`, {
      status, notes,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Payments ─────────────────────────────────────────────────────────────────
 
interface InitializePaymentParams {
  orderId: string;
  email?: string;
  channel?: 'mobile_money' | 'card';
  momoPhone?: string;
  momoProvider?: 'mtn' | 'vod' | 'tgo';
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
 
// ─── Store follow ─────────────────────────────────────────────────────────────
 
export const followStore = async (storeId: string) => {
  try {
    const response = await api.post(`/business/${storeId}/follow`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const unfollowStore = async (storeId: string) => {
  try {
    const response = await api.delete(`/business/${storeId}/follow`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
// ─── Location ─────────────────────────────────────────────────────────────────
 
export const updateUserLocation = async (latitude: number, longitude: number) => {
  try {
    const response = await api.put('/auth/location', { latitude, longitude });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
 
export const updateDriverLocation = async (
  deliveryId: string,
  latitude: number,
  longitude: number
) => {
  try {
    const response = await api.put(`/deliveries/${deliveryId}/location`, {
      latitude,
      longitude,
    });
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

// ─── Admin Driver Verifications ─────────────────────────────────────────────


export const getPendingDriverVerifications = async () => {
  try {
    const response = await api.get('/admin/driver-verifications');
    // Normalize response if needed
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getDriverVerificationDetails = async (id: string) => {
  try {
    const response = await api.get(`/admin/driver-verifications/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const approveDriverVerification = async (id: string) => {
  try {
    const response = await api.put(`/admin/driver-verifications/${id}/approve`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const rejectDriverVerification = async (id: string, reason: string) => {
  try {
    const response = await api.put(`/admin/driver-verifications/${id}/reject`, { reason });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

// ─── Advertising / Banner Campaigns ──────────────────────────────────────────

export const createBannerCampaign = async (formData: FormData) => {
  try {
    const response = await api.post('/advertising/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getMyBannerCampaigns = async () => {
  try {
    const response = await api.get('/advertising/banners/my');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getAllBannerCampaigns = async () => {
  try {
    const response = await api.get('/advertising/banners/all');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateBannerCampaignStatus = async (
  campaignId: string,
  status: 'Active' | 'Rejected' | 'Approved',
  reason?: string
) => {
  try {
    const response = await api.put(`/advertising/banners/${campaignId}/status`, {
      status,
      reason,
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getActiveBanners = async () => {
  try {
    const response = await api.get('/advertising/banners/active');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const initializeBannerPayment = async (payload: { campaignId: string; email: string }) => {
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
export const searchStores = async (params: {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
}) => {
  try {
    const response = await api.get('/business/all', { params });
    // Normalize response: getAllBusinesses returns { success: true, data: [...], pagination: {...} }
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
