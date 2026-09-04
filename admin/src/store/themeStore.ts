import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'admin:themePreference';

function getSystemScheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(pref: ThemePreference, systemScheme: 'light' | 'dark'): 'light' | 'dark' {
  return pref === 'system' ? systemScheme : pref;
}

function applyDocumentClass(resolvedTheme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
}

interface ThemeStore {
  preference: ThemePreference;
  systemScheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
  setPreference: (pref: ThemePreference) => void;
}

const storedPreference = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? 'light';
const initialSystemScheme = getSystemScheme();
const initialResolved = resolve(storedPreference, initialSystemScheme);
applyDocumentClass(initialResolved);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  preference: storedPreference,
  systemScheme: initialSystemScheme,
  resolvedTheme: initialResolved,
  setPreference: (pref) => {
    localStorage.setItem(STORAGE_KEY, pref);
    const resolvedTheme = resolve(pref, get().systemScheme);
    applyDocumentClass(resolvedTheme);
    set({ preference: pref, resolvedTheme });
  },
}));

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const systemScheme = e.matches ? 'dark' : 'light';
  const { preference } = useThemeStore.getState();
  const resolvedTheme = resolve(preference, systemScheme);
  applyDocumentClass(resolvedTheme);
  useThemeStore.setState({ systemScheme, resolvedTheme });
});
