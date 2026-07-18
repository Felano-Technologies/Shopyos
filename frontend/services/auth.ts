import { queryClient } from '@/lib/query/client';
import { api, extractErrorMessage, API_URL, secureStorage, storage } from './client';
import { cacheUserProfile, clearUserProfileCache } from './storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthConfig = {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
};

const getGoogleAuthConfig = (): GoogleAuthConfig => ({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
});

export const isGoogleAuthConfigured = () => {
  const config = getGoogleAuthConfig();

  if (Platform.OS === 'ios') return Boolean(config.iosClientId);
  if (Platform.OS === 'android') return Boolean(config.androidClientId);
  return Boolean(config.webClientId);
};

export const useGoogleAuth = () => {
  const config = getGoogleAuthConfig();

  return Google.useAuthRequest({
    webClientId: config.webClientId || 'google-auth-not-configured.apps.googleusercontent.com',
    iosClientId: config.iosClientId || 'google-auth-not-configured.apps.googleusercontent.com',
    androidClientId: config.androidClientId || 'google-auth-not-configured.apps.googleusercontent.com',
  });
};

export const signInWithGoogle = async (idToken: string, referralCode?: string) => {
  try {
    const response = await api.post('/auth/google', {
      idToken,
      ...(referralCode?.trim() && { referralCode: referralCode.trim() }),
    });
    const payload = response.data?.data || {};
    if (payload.token) {
      await secureStorage.setItem('userToken', payload.token);
      if (payload.refreshToken) await secureStorage.setItem('refreshToken', payload.refreshToken);
      try {
        const meResponse = await api.get('/auth/me');
        const me = meResponse.data?.user || meResponse.data;
        if (me?.id) {
          await storage.setItem('userId', me.id);
          const { initCartForUser } = require('@/store/cartStore');
          await initCartForUser(me.id);
        }
        await cacheUserProfile(me);
      } catch (e) {
        console.warn('Failed to sync profile after google sign-in:', e);
      }
      try {
        const pushToken = await storage.getItem('expoPushToken');
        if (pushToken) await registerPushTokenInBackend(pushToken);
      } catch (e) {
        console.warn('Failed to register push token after google sign-in:', e);
      }
    }
    const needsRole =
      payload.requiresRoleSelection ||
      payload.role === 'none' ||
      !payload.role ||
      (payload.roles?.length === 0);
    return { ...response.data, ...payload, needsRole };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || `Google sign-in failed: ${error.response.status}`);
    throw new Error(error.message || 'Network error during Google sign-in');
  }
};

export const registerUser = async (
  name: string,
  email: string,
  password: string,
  fullPhoneNumber: string,
  referralCode?: string,
  termsAccepted?: boolean,
  privacyAccepted?: boolean
) => {
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[RegisterFlow] +${Date.now() - t0}ms ${msg}`);
  try {
    log('POST /auth/register...');
    const response = await api.post('/auth/register', { name, email, fullPhoneNumber, password, referralCode, termsAccepted, privacyAccepted });
    log(`/auth/register responded: status=${response.status} message=${response.data?.message}`);
    const payload = response.data?.data || {};
    if (payload.token) {
      log('Token received — persisting session and clearing stale profile cache');
      await clearUserProfileCache();
      await secureStorage.setItem('userToken', payload.token);
      if (payload.refreshToken) await secureStorage.setItem('refreshToken', payload.refreshToken);
      // Mirror loginUser: store userId, cache the profile, and key the cart so
      // the very next screens (role selection, home) aren't racing an empty store
      try {
        log('GET /auth/me...');
        const meResponse = await api.get('/auth/me');
        const me = meResponse.data?.user || meResponse.data;
        log(`/auth/me responded: role=${me?.role} id=${me?.id}`);
        if (me?.id) {
          await storage.setItem('userId', me.id);
          const { initCartForUser } = require('@/store/cartStore');
          log('Initializing cart for user...');
          await initCartForUser(me.id);
          log('Cart initialized');
        }
        await cacheUserProfile(me);
      } catch (meErr) {
        log(`/auth/me FAILED: ${meErr instanceof Error ? meErr.message : meErr}`);
        console.warn('Could not fetch profile after registration:', meErr);
      }
      try {
        const pushToken = await storage.getItem('expoPushToken');
        if (pushToken) {
          log('Registering push token...');
          await registerPushTokenInBackend(pushToken);
          log('Push token registered');
        } else {
          log('No push token stored yet — skipping registration');
        }
      } catch (err) {
        log(`Push token registration FAILED: ${err instanceof Error ? err.message : err}`);
        console.warn('Failed syncing expo push token on register:', err);
      }
    }
    log(`registerUser() resolving — requiresRoleSelection=${payload.requiresRoleSelection}`);
    return { ...response.data, ...payload };
  } catch (error: any) {
    log(`registerUser() FAILED: ${error?.response ? `HTTP ${error.response.status}` : error.message}`);
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
  // Unregister this device's push token while the request is still
  // authenticated, so pushes stop reaching a signed-out device.
  try {
    const pushToken = await storage.getItem('expoPushToken');
    if (pushToken) await api.delete('/notifications/push-token', { data: { token: pushToken } });
  } catch (error) {
    console.warn('Failed to unregister push token on logout:', error);
  }
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('Error calling logout API:', error);
  } finally {
    queryClient.clear();
    await storage.removeItem('SHOPYOS_QUERY_CACHE');
    // Cart storage is already namespaced per userId (cartStore.ts), so it
    // doesn't need wiping on logout — leaving it lets the same user's cart
    // survive a logout/login cycle.
    await Promise.all([
      secureStorage.removeItem('userToken'),
      secureStorage.removeItem('refreshToken'),
      secureStorage.removeItem('businessToken'),
      storage.removeItem('userId'),
      storage.removeItem('currentBusinessId'),
      storage.removeItem('currentBusinessVerificationStatus'),
      storage.removeItem('userRole'),
      storage.removeItem('cart-storage'), // remove legacy shared cart key
      clearUserProfileCache(),
    ]);
    try {
      const { socketService } = require('./socket');
      socketService.disconnect();
    } catch (e) {
      console.error('Failed to disconnect socket on logout:', e);
    }
  }
};

export const loginUser = async (
  email: string,
  password: string,
  latitude: number,
  longitude: number
) => {
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[LoginFlow] +${Date.now() - t0}ms ${msg}`);
  try {
    log('POST /auth/login...');
    // Login is safe to retry on a lost response (no client-visible state change on the server)
    const response = await api.post('/auth/login', { email, password, latitude, longitude }, { retryOnNetworkError: true } as any);
    log(`/auth/login responded: status=${response.status} message=${response.data?.message}`);
    const payload = response.data?.data || {};
    if (payload.token) {
      log('Token received — persisting session and clearing stale profile cache');
      await clearUserProfileCache();
      await secureStorage.setItem('userToken', payload.token);
      if (payload.refreshToken) await secureStorage.setItem('refreshToken', payload.refreshToken);
      try {
        log('GET /auth/me...');
        const meResponse = await api.get('/auth/me');
        const me = meResponse.data?.user || meResponse.data;
        log(`/auth/me responded: role=${me?.role} id=${me?.id}`);
        if (me?.id) {
          await storage.setItem('userId', me.id);
          const { initCartForUser } = require('@/store/cartStore');
          log('Initializing cart for user...');
          await initCartForUser(me.id);
          log('Cart initialized');
        }
        await cacheUserProfile(me);
      } catch (meErr) {
        log(`/auth/me FAILED: ${meErr instanceof Error ? meErr.message : meErr}`);
        console.warn('Could not fetch userId after login:', meErr);
      }
      try {
        const pushToken = await storage.getItem('expoPushToken');
        if (pushToken) {
          log('Registering push token...');
          await registerPushTokenInBackend(pushToken);
          log('Push token registered');
        } else {
          log('No push token stored yet — skipping registration');
        }
      } catch (err) {
        log(`Push token registration FAILED: ${err instanceof Error ? err.message : err}`);
        console.warn('Failed syncing expo push token on login:', err);
      }
    }
    const needsRole =
      payload.requiresRoleSelection ||
      payload.role === 'none' ||
      !payload.role ||
      (payload.roles?.length === 0);
    log(`loginUser() resolving — role=${payload.role} needsRole=${needsRole} requiresTwoFactor=${!!payload.requiresTwoFactor}`);
    return { ...response.data, ...payload, needsRole };
  } catch (error: any) {
    log(`loginUser() FAILED: ${error?.response ? `HTTP ${error.response.status}` : error.message}`);
    if (error.response) throw new Error(error.response.data?.error || `Sevalla Edge Error: ${error.response.status}`);
    throw new Error(error.message || 'Network error during login');
  }
};

// Complete a login after tokens are issued (shared by password login and 2FA verify)
const completeAuthSession = async (payload: any) => {
  await clearUserProfileCache();
  await secureStorage.setItem('userToken', payload.token);
  if (payload.refreshToken) await secureStorage.setItem('refreshToken', payload.refreshToken);
  try {
    const meResponse = await api.get('/auth/me');
    const me = meResponse.data?.user || meResponse.data;
    if (me?.id) {
      await storage.setItem('userId', me.id);
      const { initCartForUser } = require('@/store/cartStore');
      await initCartForUser(me.id);
    }
    await cacheUserProfile(me);
  } catch (meErr) {
    console.warn('Could not fetch profile after login:', meErr);
  }
  try {
    const pushToken = await storage.getItem('expoPushToken');
    if (pushToken) await registerPushTokenInBackend(pushToken);
  } catch (err) {
    console.warn('Failed syncing expo push token on login:', err);
  }
};

// Verify a 2FA code and finish logging in
export const verifyTwoFactorLogin = async (twoFaToken: string, code: string) => {
  try {
    const response = await api.post('/auth/2fa/verify', { twoFaToken, code });
    const payload = response.data?.data || {};
    if (payload.token) {
      await completeAuthSession(payload);
    }
    const needsRole =
      payload.requiresRoleSelection ||
      payload.role === 'none' ||
      !payload.role ||
      (payload.roles?.length === 0);
    return { ...response.data, ...payload, needsRole };
  } catch (error: any) {
    if (error.response) throw new Error(error.response.data?.error || `Verification failed: ${error.response.status}`);
    throw new Error(error.message || 'Network error during verification');
  }
};

// ── Security & privacy settings ──────────────────────────────────────────────

export const getSecuritySettings = async (): Promise<{
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  privacySettings: Record<string, boolean>;
}> => {
  try {
    const response = await api.get('/auth/security-settings');
    return response.data?.data || response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const updateSecuritySettings = async (settings: {
  twoFactorEnabled?: boolean;
  loginAlertsEnabled?: boolean;
  privacySettings?: Record<string, boolean>;
}) => {
  try {
    const response = await api.put('/auth/security-settings', settings);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getActiveSessions = async (): Promise<{
  sessions: { id: string; device: string | null; ip: string | null; createdAt: string; expiresAt: string }[];
  count: number;
}> => {
  try {
    const response = await api.get('/auth/sessions');
    return response.data?.data || response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const revokeSession = async (sessionId: string) => {
  try {
    const response = await api.delete(`/auth/sessions/${sessionId}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const logoutAllSessions = async () => {
  try {
    const response = await api.post('/auth/logout-all');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const requestDataExport = async () => {
  try {
    const response = await api.post('/auth/export-data');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const requestAccountDeletion = async () => {
  try {
    const response = await api.post('/auth/delete-account');
    return response.data;
  } catch (error: any) {
    throw new Error(error.userMessage || extractErrorMessage(error));
  }
};

export const getUserData = async (options?: { background?: boolean }) => {
  try {
    // Background callers (fire-and-forget refreshes, polling) opt in so a
    // stale/expired token doesn't yank the user to /login mid-action — see
    // isBackgroundRequest handling in client.ts's 401 interceptor.
    const response = await api.get('/auth/me', { isBackgroundRequest: options?.background } as any);
    return response.data?.user ?? response.data;
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
    // Backend add-role is idempotent, so a lost-response retry is safe
    const response = await api.post('/auth/add-role', { role }, { retryOnNetworkError: true } as any);
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
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }

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
