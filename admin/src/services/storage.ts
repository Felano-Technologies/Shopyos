// services/storage.ts
/**
 * Standard Storage wrapper (localStorage)
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
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
 * SecureStore wrapper (localStorage fallback on Web)
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  },
};
