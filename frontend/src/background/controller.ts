/**
 * Background Task Controller
 * Centralized logic for starting/stopping background tasks based on user state
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/services/api';
import { TASK_DRIVER_LOCATION } from './taskNames';
import { flushQueue, clearQueue } from './queue';

export interface UserState {
  role?: string;
  activeDeliveryId?: string | null;
  shareLiveLocation?: boolean;
}

/**
 * Check if background location tracking is currently running
 */
export const isTrackingLocation = async (): Promise<boolean> => {
  try {
    return await TaskManager.isTaskRegisteredAsync(TASK_DRIVER_LOCATION);
  } catch (error) {
    console.error('[TaskController] Error checking tracking status:', error);
    return false;
  }
};

/**
 * Start driver background location tracking
 * Only starts if all conditions are met:
 * - User is a driver
 * - Has an active delivery
 * - Has enabled location sharing
 * - Has granted location permissions
 */
export const startDriverLocationTracking = async (
  deliveryId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('[TaskController] Starting driver location tracking for delivery:', deliveryId);

    // Check if already tracking
    const isTracking = await isTrackingLocation();
    if (isTracking) {
      console.log('[TaskController] Already tracking location');
      return { success: true, message: 'Already tracking location' };
    }

    // Check location permissions
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return { success: false, message: 'Foreground location permission not granted' };
    }

    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      return { success: false, message: 'Background location permission not granted' };
    }

    // Store active delivery ID for the background task
    await AsyncStorage.setItem('activeDeliveryId', deliveryId);

    // Start location updates with battery-friendly configuration
    await Location.startLocationUpdatesAsync(TASK_DRIVER_LOCATION, {
      accuracy: Location.Accuracy.Balanced, // Balance between accuracy and battery
      distanceInterval: 100, // Update every 100 meters
      timeInterval: 30000, // Or every 30 seconds, whichever comes first
      foregroundService: {
        notificationTitle: 'Active Delivery',
        notificationBody: 'Tracking your location for real-time delivery updates',
        notificationColor: '#0C1559',
      },
      pausesUpdatesAutomatically: false, // Keep tracking even when stationary
      showsBackgroundLocationIndicator: true, // iOS: show blue bar
    });

    console.log('[TaskController] Location tracking started successfully');
    return { success: true, message: 'Location tracking started' };
  } catch (error: any) {
    console.error('[TaskController] Failed to start location tracking:', error);
    return { success: false, message: error.message || 'Failed to start tracking' };
  }
};

/**
 * Stop driver background location tracking
 */
export const stopDriverLocationTracking = async (): Promise<void> => {
  try {
    console.log('[TaskController] Stopping driver location tracking');

    const isTracking = await isTrackingLocation();
    if (isTracking) {
      await Location.stopLocationUpdatesAsync(TASK_DRIVER_LOCATION);
      console.log('[TaskController] Location tracking stopped');
    }

    // Clear active delivery ID
    await AsyncStorage.removeItem('activeDeliveryId');

    // Try to flush any queued locations one last time
    await flushQueue();
  } catch (error) {
    console.error('[TaskController] Error stopping location tracking:', error);
  }
};

/**
 * Request all required location permissions
 * Shows system prompts if not already granted
 */
export const requestLocationPermissions = async (): Promise<{
  foreground: boolean;
  background: boolean;
}> => {
  try {
    // Request foreground first
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    const foregroundGranted = foregroundStatus === 'granted';

    if (!foregroundGranted) {
      return { foreground: false, background: false };
    }

    // Then request background (only if foreground is granted)
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    const backgroundGranted = backgroundStatus === 'granted';

    return { foreground: foregroundGranted, background: backgroundGranted };
  } catch (error) {
    console.error('[TaskController] Error requesting permissions:', error);
    return { foreground: false, background: false };
  }
};

/**
 * Get location sharing preference from storage
 */
export const getLocationSharingPreference = async (): Promise<boolean> => {
  try {
    const value = await storage.getItem('shareLiveLocation');
    return value === 'true';
  } catch (error) {
    console.error('[TaskController] Error getting location sharing preference:', error);
    return false;
  }
};

/**
 * Set location sharing preference in storage
 */
export const setLocationSharingPreference = async (enabled: boolean): Promise<void> => {
  try {
    await storage.setItem('shareLiveLocation', enabled ? 'true' : 'false');
    console.log('[TaskController] Location sharing preference set to:', enabled);
  } catch (error) {
    console.error('[TaskController] Error setting location sharing preference:', error);
  }
};

/**
 * Main function to ensure background tasks are in the correct state
 * Call this whenever user state changes (login, logout, role change, delivery start/end)
 */
export const ensureBackgroundTasksForUser = async (userState: UserState): Promise<void> => {
  try {
    console.log('[TaskController] Ensuring background tasks for user state:', userState);

    const { role, activeDeliveryId, shareLiveLocation } = userState;

    // Check if user is a driver
    const isDriver = role?.toLowerCase() === 'driver';

    // Check if should be tracking
    const shouldTrack =
      isDriver &&
      !!activeDeliveryId &&
      shareLiveLocation === true;

    const isCurrentlyTracking = await isTrackingLocation();

    if (shouldTrack && !isCurrentlyTracking) {
      // Need to start tracking
      console.log('[TaskController] Should start tracking');
      const result = await startDriverLocationTracking(activeDeliveryId!);
      if (!result.success) {
        console.warn('[TaskController] Failed to start tracking:', result.message);
      }
    } else if (!shouldTrack && isCurrentlyTracking) {
      // Need to stop tracking
      console.log('[TaskController] Should stop tracking');
      await stopDriverLocationTracking();
    } else {
      console.log('[TaskController] No action needed. Currently tracking:', isCurrentlyTracking, 'Should track:', shouldTrack);
    }
  } catch (error) {
    console.error('[TaskController] Error in ensureBackgroundTasksForUser:', error);
  }
};
