import { create } from 'zustand';

interface AuthStore {
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  activeMode: 'buyer' | null;
  originalRole: string | null;
  switchToBuyerMode: (fromRole: string) => void;
  exitBuyerMode: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  activeMode: null,
  originalRole: null,
  switchToBuyerMode: (fromRole) => set({ activeMode: 'buyer', originalRole: fromRole }),
  exitBuyerMode: () => set({ activeMode: null, originalRole: null }),
}));
