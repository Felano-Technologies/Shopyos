import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserData, updateOnboardingState } from '@/services/api';

interface OnboardingState {
  [key: string]: boolean;
}

interface OnboardingContextType {
  onboardingState: OnboardingState;
  isTourActive: boolean;
  activeScreen: string | null;
  startTour: (screen: string) => void;
  stopTour: () => void;
  markCompleted: (screen: string) => Promise<void>;
  isCompleted: (screen: string) => boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({});
  const [isTourActive, setIsTourActive] = useState(false);
  const [activeScreen, setActiveScreen] = useState<string | null>(null);

  useEffect(() => {
    loadOnboardingState();
  }, []);

  const loadOnboardingState = async () => {
    try {
      const userData = await getUserData();
      if (userData?.onboarding_state) {
        setOnboardingState(userData.onboarding_state);
        return userData.onboarding_state;
      }
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
    }
    return null;
  };

  const startTour = async (screen: string) => {
    let current = onboardingState;
    if (Object.keys(current).length === 0) {
      const fresh = await loadOnboardingState();
      if (fresh) current = fresh;
    }
    
    if (!current[screen]) {
      setActiveScreen(screen);
      setIsTourActive(true);
    }
  };

  const stopTour = () => {
    setIsTourActive(false);
    setActiveScreen(null);
  };

  const markCompleted = async (screen: string) => {
    try {
      await updateOnboardingState(screen, true);
      setOnboardingState(prev => ({ ...prev, [screen]: true }));
      stopTour();
    } catch (error) {
      console.error('Failed to mark onboarding as completed:', error);
    }
  };

  const isCompleted = (screen: string) => !!onboardingState[screen];

  return (
    <OnboardingContext.Provider
      value={{
        onboardingState,
        isTourActive,
        activeScreen,
        startTour,
        stopTour,
        markCompleted,
        isCompleted,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
