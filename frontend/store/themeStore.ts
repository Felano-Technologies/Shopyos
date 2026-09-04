import { create } from 'zustand';
import { Appearance, ColorSchemeName } from 'react-native';
import { storage } from '@/services/storage';
import { getThemePreference, updateThemePreference as patchThemePreference } from '@/services/auth';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'themePreference';

type ThemeStore = {
  preference: ThemePreference;
  systemScheme: ColorSchemeName;
  resolvedTheme: 'light' | 'dark';
  hydrated: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
};

const resolve = (preference: ThemePreference, systemScheme: ColorSchemeName): 'light' | 'dark' =>
  preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

export const useThemeStore = create<ThemeStore>((set, get) => ({
  preference: 'system',
  systemScheme: Appearance.getColorScheme(),
  resolvedTheme: resolve('system', Appearance.getColorScheme()),
  hydrated: false,

  setPreference: async (pref) => {
    const prev = get().preference;
    set({ preference: pref, resolvedTheme: resolve(pref, get().systemScheme) });
    try {
      await storage.setItem(STORAGE_KEY, pref);
      await patchThemePreference(pref);
    } catch (e) {
      set({ preference: prev, resolvedTheme: resolve(prev, get().systemScheme) });
      throw e;
    }
  },
}));

// Live-update resolvedTheme when the device's system scheme changes and
// preference is 'system' — mirrors cartStore's module-level subscription idiom.
Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.setState((state) => ({
    systemScheme: colorScheme,
    resolvedTheme: resolve(state.preference, colorScheme),
  }));
});

/**
 * Read the last-known local preference before first paint, so the app
 * never flashes the wrong theme. Call once from RootLayout before render.
 */
export async function hydrateThemeLocal(): Promise<void> {
  try {
    const stored = await storage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) {
      useThemeStore.setState((state) => ({
        preference: stored,
        resolvedTheme: resolve(stored, state.systemScheme),
      }));
    }
  } finally {
    useThemeStore.setState({ hydrated: true });
  }
}

/**
 * Reconcile with the backend's stored preference (source of truth across
 * devices). Call after a userId is known, e.g. alongside initCartForUser.
 */
export async function initThemeForUser(): Promise<void> {
  try {
    const res = await getThemePreference();
    const remote = res?.theme_preference;
    if (isThemePreference(remote) && remote !== useThemeStore.getState().preference) {
      useThemeStore.setState((state) => ({
        preference: remote,
        resolvedTheme: resolve(remote, state.systemScheme),
      }));
      await storage.setItem(STORAGE_KEY, remote);
    }
  } catch {
    // Offline or guest session — keep whatever local value is already applied.
  }
}
