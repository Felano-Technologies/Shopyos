import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getUserData, updateOnboardingState, secureStorage, storage } from '../services/api';
import { cacheUserProfile, getCachedUserProfile } from '../services/storage';
import { useAuthStore } from '../store/authStore';

// Guests have no account to persist onboarding_state on server-side, so
// completed tours are tracked locally instead — otherwise every tour would
// either replay each session (never marked done) or 401 trying to save.
const GUEST_ONBOARDING_KEY = 'guestOnboardingState';

interface OnboardingState {
  [key: string]: boolean;
}

interface OnboardingContextType {
  onboardingState: OnboardingState;
  isTourActive: boolean;
  activeScreen: string | null;
  user: any;
  isLoading: boolean;
  startTour: (screen: string) => Promise<void>;
  stopTour: () => void;
  markCompleted: (screen: string) => Promise<void>;
  isCompleted: (screen: string) => boolean;
  refresh: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({});
  const [isTourActive, setIsTourActive] = useState(false);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const exitBuyerMode = useAuthStore((s) => s.exitBuyerMode);

  useEffect(() => {
    const init = async () => {
      const token = await secureStorage.getItem('userToken');
      if (token) {
        setAuthenticated(true);
        await loadOnboardingState();
      } else {
        setAuthenticated(false);
        exitBuyerMode();
        setUser(null);
        await loadGuestOnboardingState();
      }
    };
    init();
  }, [setAuthenticated, exitBuyerMode]);

  // Listen for login/logout by checking storage or other auth signals
  // For now, we can expose a refresh method and call it after login
  const refresh = async () => {
    await loadOnboardingState();
  };

  const loadGuestOnboardingState = async () => {
    try {
      const raw = await storage.getItem(GUEST_ONBOARDING_KEY);
      setOnboardingState(raw ? JSON.parse(raw) : {});
    } catch {
      setOnboardingState({});
    } finally {
      setIsLoading(false);
    }
  };

  const loadOnboardingState = async () => {
    setIsLoading(true);
    try {
      const cached = await getCachedUserProfile();
      if (cached) {
        setUser(cached);
        setAuthenticated(true);
        setOnboardingState((cached as any).onboarding_state ?? {});
      }
      getUserData()
        .then(fresh => {
          cacheUserProfile(fresh);
          setUser(fresh);
          setAuthenticated(true);
          setOnboardingState(fresh.onboarding_state ?? {});
        })
        .catch(() => {});
      return (cached as any)?.onboarding_state ?? null;
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const startTour = async (screen: string) => {
    if (isCompleted(screen)) return;
    setActiveScreen(screen);
    setIsTourActive(true);
  };

  const stopTour = () => {
    setIsTourActive(false);
    setActiveScreen(null);
  };

  const markCompleted = async (screen: string) => {
    // Always update local state and stop the tour regardless of whether
    // persistence succeeds — a failed save shouldn't replay the tour
    // mid-session, and for a guest there's no server-side state to save to.
    const next = { ...onboardingState, [screen]: true };
    setOnboardingState(next);
    stopTour();
    try {
      const token = await secureStorage.getItem('userToken');
      if (token) {
        await updateOnboardingState(screen, true);
      } else {
        await storage.setItem(GUEST_ONBOARDING_KEY, JSON.stringify(next));
      }
    } catch (error) {
      console.error('Failed to persist onboarding completion:', error);
    }
  };

  const isCompleted = (screen: string) => !!onboardingState[screen];

  const contextValue = useMemo(
    () => ({
      onboardingState,
      isTourActive,
      activeScreen,
      user,
      isLoading,
      startTour,
      stopTour,
      markCompleted,
      isCompleted,
      refresh,
    }),
    [onboardingState, isTourActive, activeScreen, user, isLoading, startTour, stopTour, markCompleted, isCompleted, refresh],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

export default OnboardingProvider;

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
