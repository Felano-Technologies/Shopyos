import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getUserData, updateOnboardingState, secureStorage } from '../services/api';
import { cacheUserProfile, getCachedUserProfile } from '../services/storage';
import { useAuthStore } from '../store/authStore';

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
        setOnboardingState({});
        setUser(null);
        setIsLoading(false);
      }
    };
    init();
  }, [setAuthenticated, exitBuyerMode]);

  // Listen for login/logout by checking storage or other auth signals
  // For now, we can expose a refresh method and call it after login
  const refresh = async () => {
    await loadOnboardingState();
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
    return; // Onboarding tours disabled for now
  };

  const stopTour = () => {
    setIsTourActive(false);
    setActiveScreen(null);
  };

  const markCompleted = async (screen: string) => {
    try {
      // 1. Update DB first
      await updateOnboardingState(screen, true);
      // 2. Update local state
      setOnboardingState(prev => ({ ...prev, [screen]: true }));
      // 3. Stop UI tour
      stopTour();
    } catch (error) {
      console.error('Failed to mark onboarding as completed:', error);
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
