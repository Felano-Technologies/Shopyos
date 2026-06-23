import { api, extractErrorMessage, API_URL } from './client';
import { cacheUserProfile, clearUserProfileCache, secureStorage, storage } from './storage';
import { queryClient } from '../lib/query/client';

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  fullPhoneNumber: string,
  referralCode?: string,
  termsAccepted?: boolean,
  privacyAccepted?: boolean
) => {
  try {
    const response = await api.post('/auth/register', {
      name,
      email,
      fullPhoneNumber,
      password,
      referralCode,
      termsAccepted,
      privacyAccepted,
    });
    if (response.data.token) {
      await secureStorage.setItem('userToken', response.data.token);
      if (response.data.refreshToken) await secureStorage.setItem('refreshToken', response.data.refreshToken);
      try {
        const meResponse = await api.get('/auth/me');
        if (meResponse.data?.id) {
          await storage.setItem('userId', meResponse.data.id);
        }
        await cacheUserProfile(meResponse.data);
      } catch (err) {
        console.warn('Failed syncing profile details:', err);
      }
    }
    return response.data;
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || `can't reach server : ${error.response.status}`);
    throw new Error(error.message || 'Network error during registration');
  }
};

export const requestPasswordResetOTP = async (email: string, method: 'email' | 'sms') => {
  try {
    const response = await api.post('/auth/forgot-password', { email, method });
    return response.data as { success: boolean; maskedTarget: string; message: string };
  } catch (error: any) {
    if (error.response?.data?.error) throw new Error(error.response.data.error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const verifyPasswordResetOTP = async (email: string, code: string) => {
  try {
    const response = await api.post('/auth/forgot-password/verify', { email, code });
    return response.data as { success: boolean; resetToken: string };
  } catch (error: any) {
    if (error.response?.data?.error) throw new Error(error.response.data.error);
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const resetPasswordWithToken = async (resetToken: string, newPassword: string) => {
  try {
    const response = await api.post('/auth/forgot-password/reset', { resetToken, newPassword });
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
      clearUserProfileCache(),
    ]);
    try {
      const { socketService } = await import('./socket');
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
        if (meResponse.data?.id) {
          await storage.setItem('userId', meResponse.data.id);
        }
        await cacheUserProfile(meResponse.data);
      } catch (meErr) {
        console.warn('Could not fetch userId after login:', meErr);
      }
    }
    const needsRole =
      response.data.requiresRoleSelection ||
      response.data.role === 'none' ||
      !response.data.role ||
      (response.data.roles?.length === 0);
    return { ...response.data, needsRole };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || `Login Error: ${error.response.status}`);
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

export const uploadAvatar = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('avatar', file);

    const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
    const response = await fetch(`${API_URL}upload/avatar`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const raw = await response.text();
    let parsed: any = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch {}

    if (!response.ok) {
      const msg = parsed?.error || `Failed to upload avatar (${response.status})`;
      throw new Error(msg);
    }
    return parsed;
  } catch (error: any) {
    throw new Error(error.message || 'Network error during avatar upload');
  }
};

export const forceResetPassword = async (newPassword: string) => {
  try {
    const response = await api.put('/auth/force-reset-password', { newPassword });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.error) throw new Error(error.response.data.error);
    throw new Error(error.userMessage || extractErrorMessage(error));
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
