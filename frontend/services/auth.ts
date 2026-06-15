import { queryClient } from '@/lib/query/client';
import { api, extractErrorMessage, API_URL, secureStorage, storage } from './client';
import { cacheUserProfile, clearUserProfileCache } from './storage';

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  fullPhoneNumber: string,
  referralCode?: string
) => {
  try {
    const response = await api.post('/auth/register', { name, email, fullPhoneNumber, password, referralCode });
    if (response.data.token) {
      await secureStorage.setItem('userToken', response.data.token);
      if (response.data.refreshToken) await secureStorage.setItem('refreshToken', response.data.refreshToken);
      try {
        const pushToken = await storage.getItem('expoPushToken');
        if (pushToken) await registerPushTokenInBackend(pushToken);
      } catch (err) {
        console.warn('Failed syncing expo push token on register:', err);
      }
    }
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || `can't reach server : ${error.response.status}`);
    throw new Error(error.message || 'Network error during registration');
  }
};

export const registerPushTokenInBackend = async (token: string) => {
  try {
    const response = await api.post('/notifications/push-token', { token, deviceName: 'Mobile App' });
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
      clearUserProfileCache(),
    ]);
    try {
      const { socketService } = require('./socket');
      socketService.disconnect();
    } catch {}
  }
};

export const loginUser = async (
  email: string,
  password: string,
  latitude: number,
  longitude: number
) => {
  try {
    const response = await api.post('/auth/login', { email, password, latitude, longitude });
    if (response.data.token) {
      await secureStorage.setItem('userToken', response.data.token);
      if (response.data.refreshToken) await secureStorage.setItem('refreshToken', response.data.refreshToken);
      try {
        const meResponse = await api.get('/auth/me');
        if (meResponse.data?.id) await storage.setItem('userId', meResponse.data.id);
        await cacheUserProfile(meResponse.data);
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
      (response.data.roles?.length === 0);
    return { ...response.data, needsRole };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || `Sevalla Edge Error: ${error.response.status}`);
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

function inferMimeType(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

export const uploadAvatar = async (uri: string, options?: { fileName?: string; mimeType?: string }) => {
  try {
    const formData = new FormData();
    const filename = options?.fileName || uri.split('/').pop() || `avatar_${Date.now()}.jpg`;
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const type = options?.mimeType || inferMimeType(ext);
    formData.append('avatar', { uri, name: filename, type } as any);

    const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
    const response = await fetch(`${API_URL}upload/avatar`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });

    const raw = await response.text();
    let parsed: any = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch {}

    if (!response.ok) {
      const msg =
        parsed?.error ||
        (Array.isArray(parsed?.errors) ? parsed.errors.join(', ') : null) ||
        `Failed to upload avatar (${response.status})`;
      throw new Error(msg);
    }
    return parsed;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data.error || 'Failed to upload avatar');
    throw new Error(error.message || 'Network error during avatar upload');
  }
};

export const updateUserLocation = async (latitude: number, longitude: number) => {
  try {
    const response = await api.put('/auth/location', { latitude, longitude });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const blockUser = async (blockedId: string) => {
  try {
    const response = await api.post('/user-actions/block', { blockedId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const unblockUser = async (blockedId: string) => {
  try {
    const response = await api.delete(`/user-actions/block/${blockedId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getBlockedUsers = async () => {
  try {
    const response = await api.get('/user-actions/blocks');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const reportEntity = async (entityType: 'user' | 'store', entityId: string, reason: string, details?: string) => {
  try {
    const response = await api.post('/user-actions/report', { entityType, entityId, reason, details });
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};
