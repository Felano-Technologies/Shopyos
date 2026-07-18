import axios from 'axios';
import { clearUserProfileCache, storage, secureStorage } from './storage';
export { storage, secureStorage };
import { CustomInAppToast } from '@/components/InAppToastHost';
export { CustomInAppToast };
import { resetToRoute } from '@/utils/navigation';

const getBaseURL = () => {
  const isDev = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
  const apiUrl = (isDev ? process.env.EXPO_PUBLIC_DEV_API_URL : process.env.EXPO_PUBLIC_API_URL)?.trim();
  if (!apiUrl) throw new Error(isDev ? 'EXPO_PUBLIC_DEV_API_URL is not set' : 'EXPO_PUBLIC_API_URL is not set');
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
    const seconds = Number.parseInt(retryAfter, 10);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return Math.pow(2, attempt) * 1000;
};

const isDev = process.env.EXPO_PUBLIC_DEV_MODE === 'true';

export const api = axios.create({
  baseURL: API_URL,
  // Without a timeout, a lost response hangs the UI forever (axios default is 0/infinite)
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // Bypasses ngrok's browser interstitial page on web dev builds.
    ...(isDev && { 'ngrok-skip-browser-warning': '1' }),
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      const currentBusinessId = await storage.getItem('currentBusinessId');
      if (currentBusinessId) config.headers['X-Business-ID'] = currentBusinessId;

      // Every POST carries an idempotency key so lost-response retries replay
      // the original result server-side instead of acting twice. Retries reuse
      // the same config object, so the key survives across attempts.
      if ((config.method || 'get').toLowerCase() === 'post' && !config.headers['X-Idempotency-Key']) {
        config.headers['X-Idempotency-Key'] = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      }
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

// Android's OkHttp can reuse a keep-alive socket the server already closed after idle:
// the request may still be delivered but the response is lost, surfacing as a network
// error with no response. Retrying once on a fresh connection recovers silently.
// POSTs are retriable too: the X-Idempotency-Key set in the request
// interceptor makes the server replay the original response on a retry.
const IDEMPOTENT_METHODS = ['get', 'head', 'options', 'put', 'delete', 'post'];
const MAX_NETWORK_RETRIES = 3;
// Token rotation has its own refresh queue — a blind retry could race it
const NEVER_RETRY_PATHS = ['/auth/refresh'];

const isRetriableNetworkError = (error: any, originalRequest: any): boolean => {
  if (error.response || !error.request) return false;
  if ((originalRequest._networkRetryCount ?? 0) >= MAX_NETWORK_RETRIES) return false;
  if (NEVER_RETRY_PATHS.some(p => (originalRequest.url || '').includes(p))) return false;
  const method = (originalRequest.method || 'get').toLowerCase();
  return IDEMPOTENT_METHODS.includes(method) || originalRequest.retryOnNetworkError === true;
};

async function handle429(error: any, originalRequest: any): Promise<any> {
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
  throw error;
}

async function handleTokenExpired(error: any, originalRequest: any): Promise<any> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    })
      .then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      })
      .catch((err) => { throw err; });
  }

  originalRequest._retry = true;
  isRefreshing = true;

  try {
    const storedRefreshToken = await secureStorage.getItem('refreshToken');
    if (!storedRefreshToken) throw new Error('No refresh token stored');

    const refreshRes = await api.post('/auth/refresh', { refreshToken: storedRefreshToken });
    // ApiResponse.success wraps the payload: { success, message, data: { token, refreshToken } }
    const payload = refreshRes.data?.data || refreshRes.data || {};
    const { token: newAccessToken, refreshToken: newRefreshToken } = payload;
    if (!newAccessToken) throw new Error('Refresh response missing access token');

    await secureStorage.setItem('userToken', newAccessToken);
    if (newRefreshToken) await secureStorage.setItem('refreshToken', newRefreshToken);

    api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

    try {
      const { socketService } = require('./socket');
      const sock = socketService.getSocket();
      if (sock) sock.auth = { token: newAccessToken };
    } catch (e) {
      console.error('Failed to update socket auth token:', e);
    }
    // Release every request that queued while we were refreshing
    processQueue(null, newAccessToken);
    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
    return api(originalRequest);
  } catch (refreshError) {
    processQueue(refreshError, null);
    try {
      await secureStorage.removeItem('userToken');
      await secureStorage.removeItem('refreshToken');
      await storage.removeItem('userId');
      await clearUserProfileCache();
    } catch (e) {
      console.error('Failed to clear tokens after refresh error:', e);
    }
    throw refreshError;
  } finally {
    isRefreshing = false;
  }
}

// Guards the "session expired" toast so a burst of background 401s (e.g.
// several stale polls firing around the same time) only tells the user once.
let sessionExpiredNoticeShown = false;

async function handleUnauthorized(originalRequest: any): Promise<void> {
  try {
    const existingToken = await secureStorage.getItem('userToken');
    await secureStorage.removeItem('userToken');
    await secureStorage.removeItem('refreshToken');
    await storage.removeItem('userId');
    await clearUserProfileCache();
    if (!existingToken) return;

    if (originalRequest?.isBackgroundRequest) {
      // Don't yank the user out of whatever they're actively doing over a
      // background request's 401 (a stale poll, a fire-and-forget profile
      // refresh). The session is already cleared above, so the next real,
      // user-initiated request naturally hits the no-token path below and
      // redirects then — this just tells them why, without interrupting.
      if (!sessionExpiredNoticeShown) {
        sessionExpiredNoticeShown = true;
        CustomInAppToast.show({
          type: 'info',
          title: 'Session expired',
          message: 'Please log in again.',
        });
      }
      return;
    }

    resetToRoute('/login');
  } catch (storageError) {
    console.error('Error clearing tokens:', storageError);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    error.userMessage = extractErrorMessage(error);
    const originalRequest = error.config;

    if (error.response?.status === 429) {
      return handle429(error, originalRequest);
    }

    // A concurrent duplicate is still executing server-side — wait briefly and
    // retry; the idempotency layer then replays the stored response.
    if (error.response?.status === 409 && error.response?.data?.code === 'IDEMPOTENT_IN_FLIGHT') {
      const attempt = (originalRequest._inFlightRetryCount ?? 0) + 1;
      if (attempt <= 3) {
        originalRequest._inFlightRetryCount = attempt;
        await wait(1000 * attempt);
        return api(originalRequest);
      }
    }

    if (originalRequest && isRetriableNetworkError(error, originalRequest)) {
      const attempt = (originalRequest._networkRetryCount ?? 0) + 1;
      originalRequest._networkRetryCount = attempt;
      await wait(500 * attempt);
      return api(originalRequest);
    }

    // Any 401 first attempts the refresh-token flow — not just TOKEN_EXPIRED.
    // A background request can 401 spuriously (auth header race right after
    // registration, transient "user not found" read lag); wiping tokens and
    // yanking the user to /login over that stranded people mid-onboarding.
    if (error.response?.status === 401 && !originalRequest._retry) {
      const hasRefreshToken = !!(await secureStorage.getItem('refreshToken').catch(() => null));
      if (hasRefreshToken) {
        try {
          return await handleTokenExpired(error, originalRequest);
        } catch {
          await handleUnauthorized(originalRequest);
          throw error;
        }
      }
      await handleUnauthorized(originalRequest);
    }

    throw error;
  }
);
