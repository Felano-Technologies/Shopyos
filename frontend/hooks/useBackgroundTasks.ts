/**
 * Custom hook to manage background tasks based on auth and delivery state
 * Automatically starts/stops location tracking when conditions change
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getUserData } from '@/services/api';
import { useActiveDeliveries } from './useDelivery';
import {
  ensureBackgroundTasksForUser,
  getLocationSharingPreference,
  stopDriverLocationTracking,
} from '@/src/background/controller';
import { flushQueue } from '@/src/background/queue';

export const useBackgroundTasks = () => {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Fetch user data to get role
  const { data: userData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getUserData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Fetch active deliveries (only for drivers)
  const { data: activeDeliveriesData } = useActiveDeliveries({
    enabled: userData?.role?.toLowerCase() === 'driver',
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Monitor user state and ensure background tasks are correct
  useEffect(() => {
    const checkAndUpdateTasks = async () => {
      if (!userData) return;

      const role = userData.role?.toLowerCase();
      
      // Only proceed if user is a driver
      if (role !== 'driver') {
        // Stop tracking if user is not a driver
        await stopDriverLocationTracking();
        return;
      }

      // Get active delivery ID (first active delivery)
      const activeDelivery = activeDeliveriesData?.deliveries?.[0];
      const activeDeliveryId = activeDelivery?.id || null;

      // Get location sharing preference
      const shareLiveLocation = await getLocationSharingPreference();

      // Ensure tasks are in correct state
      await ensureBackgroundTasksForUser({
        role,
        activeDeliveryId,
        shareLiveLocation,
      });
    };

    checkAndUpdateTasks();
  }, [userData, activeDeliveriesData]);

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // When app comes to foreground, flush queued locations
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[BackgroundTasks] App came to foreground, flushing location queue');
        await flushQueue();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Cleanup on unmount (app close)
  useEffect(() => {
    return () => {
      // This won't run on app close, but will run if this hook unmounts
      stopDriverLocationTracking();
    };
  }, []);
};
