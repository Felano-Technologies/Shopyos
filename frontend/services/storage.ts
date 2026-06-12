// services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Standard AsyncStorage wrapper (unencrypted)
 */
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

const USER_CACHE_KEY = 'cachedUserProfile';

export async function cacheUserProfile(user: any): Promise<void> {
  await storage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export async function getCachedUserProfile(): Promise<any | null> {
  const raw = await storage.getItem(USER_CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearUserProfileCache(): Promise<void> {
  await storage.removeItem(USER_CACHE_KEY);
}

/**
 * SecureStore wrapper (encrypted)
 * Note: On Web, this falls back to localStorage (not encrypted)
 */
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
