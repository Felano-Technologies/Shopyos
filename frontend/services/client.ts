import axios from 'axios';
import { router } from 'expo-router';
import { queryClient } from '@/lib/query/client';
import { storage, secureStorage } from './storage';
export { storage, secureStorage };
import { CustomInAppToast } from '@/components/InAppToastHost';
export { CustomInAppToast };

const getBaseURL = () => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not set');
  return apiUrl.replace(/\/$/, '');
};

export const baseURL = getBaseURL();
export const API_URL = `${baseURL}/api/v1/`;

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const get429DelayMs = (error: any, attempt: number): number => {
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds * 1000;
  }
  return Math.pow(2, attempt) * 1000;
};

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const currentBusinessId = await storage.getItem('currentBusinessId');
      if (currentBusinessId) config.headers['X-Business-ID'] = currentBusinessId;
    } catch (error) {
      console.error('Error in request interceptor:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: { resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    error.userMessage = extractErrorMessage(error);
    const originalRequest = error.config as any;

    if (error.response?.status === 429) {
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
      CustomInAppToast.show({
        type: 'error',
        title: 'Too many requests',
        message: 'Please slow down and try again in a moment.',
      });
      return Promise.reject(error);
    }

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

        const refreshRes = await api.post('/auth/refresh', { refreshToken: storedRefreshToken });
        const { token: newAccessToken, refreshToken: newRefreshToken } = refreshRes.data;

        await secureStorage.setItem('userToken', newAccessToken);
        if (newRefreshToken) await secureStorage.setItem('refreshToken', newRefreshToken);

        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

        try {
          const { socketService } = require('./socket');
          const sock = socketService.getSocket();
          if (sock) sock.auth = { token: newAccessToken };
        } catch {}

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        try {
          await secureStorage.removeItem('userToken');
          await secureStorage.removeItem('refreshToken');
          await storage.removeItem('userId');
        } catch {}
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      try {
        const existingToken = await secureStorage.getItem('userToken');
        await secureStorage.removeItem('userToken');
        await secureStorage.removeItem('refreshToken');
        await storage.removeItem('userId');
        if (existingToken) router.replace('/login');
      } catch (storageError) {
        console.error('Error clearing tokens:', storageError);
      }
    }

    return Promise.reject(error);
  }
);
