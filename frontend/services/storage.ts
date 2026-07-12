// services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Hot keys are read on EVERY api request (auth interceptor) — keychain/disk
// reads there cost 1-10ms each, serialized, before any network I/O happens.
// Memoize them in memory; writes keep the cache coherent.
const HOT_KEYS = new Set(['userToken', 'businessToken', 'refreshToken', 'currentBusinessId', 'userId']);
const memo = new Map<string, string | null>();

/**
 * Standard AsyncStorage wrapper (unencrypted)
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (HOT_KEYS.has(key) && memo.has(key)) return memo.get(key) ?? null;
    const value = Platform.OS === 'web' ? localStorage.getItem(key) : await AsyncStorage.getItem(key);
    if (HOT_KEYS.has(key)) memo.set(key, value);
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (HOT_KEYS.has(key)) memo.set(key, value);
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (HOT_KEYS.has(key)) memo.set(key, null);
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await AsyncStorage.removeItem(key);
  },
};

const PROFILE_SECURE_KEY = 'secure_user_profile';

export async function cacheUserProfile(user: unknown): Promise<void> {
  await secureStorage.setItem(PROFILE_SECURE_KEY, JSON.stringify(user));
}

export async function getCachedUserProfile(): Promise<object | null> {
  const raw = await secureStorage.getItem(PROFILE_SECURE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearUserProfileCache(): Promise<void> {
  await secureStorage.removeItem(PROFILE_SECURE_KEY);
}

/**
 * SecureStore wrapper (encrypted)
 * Note: On Web, this falls back to localStorage (not encrypted)
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (HOT_KEYS.has(key) && memo.has(key)) return memo.get(key) ?? null;
    const value = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    if (HOT_KEYS.has(key)) memo.set(key, value);
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (HOT_KEYS.has(key)) memo.set(key, value);
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (HOT_KEYS.has(key)) memo.set(key, null);
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
