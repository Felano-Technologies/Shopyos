/**
 * Background Task Controller
 * Centralized logic for starting/stopping background tasks based on user state
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../../services/api';
import { TASK_DRIVER_LOCATION, TASK_LOCATION_GEOFENCE } from './taskNames';
import { flushQueue } from './queue';

export interface UserState {
  role?: string;
  activeDeliveryId?: string | null;
  shareLiveLocation?: boolean;
  /** true for ANY logged-in user; false / undefined on logout */
  isAuthenticated?: boolean;
}

// ─── Driver delivery tracking ─────────────────────────────────────────────────

export const isTrackingLocation = async (): Promise<boolean> => {
  try {
    return await TaskManager.isTaskRegisteredAsync(TASK_DRIVER_LOCATION);
  } catch { return false; }
};

export const startDriverLocationTracking = async (
  deliveryId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    if (await isTrackingLocation()) return { success: true, message: 'Already tracking' };

    const { status: fg } = await Location.getForegroundPermissionsAsync();
    if (fg !== 'granted') return { success: false, message: 'Foreground permission not granted' };

    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    if (bg !== 'granted') return { success: false, message: 'Background permission not granted' };

    await AsyncStorage.setItem('activeDeliveryId', deliveryId);

    await Location.startLocationUpdatesAsync(TASK_DRIVER_LOCATION, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      timeInterval: 30_000,
      foregroundService: {
        notificationTitle: 'Active Delivery',
        notificationBody: 'Tracking your location for real-time delivery updates',
        notificationColor: '#0C1559',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('[TaskController] Driver location tracking started');
    return { success: true, message: 'Location tracking started' };
  } catch (error: any) {
    console.error('[TaskController] Failed to start driver tracking:', error);
    return { success: false, message: error.message || 'Failed to start tracking' };
  }
};

export const stopDriverLocationTracking = async (): Promise<void> => {
  try {
    if (await isTrackingLocation()) {
      await Location.stopLocationUpdatesAsync(TASK_DRIVER_LOCATION);
      console.log('[TaskController] Driver location tracking stopped');
    }
    await AsyncStorage.removeItem('activeDeliveryId');
    await flushQueue();
  } catch (error) {
    console.error('[TaskController] Error stopping driver tracking:', error);
  }
};

// ─── Geofence / proximity tracking (all authenticated users) ─────────────────

export const isGeofenceRunning = async (): Promise<boolean> => {
  try {
    return await TaskManager.isTaskRegisteredAsync(TASK_LOCATION_GEOFENCE);
  } catch { return false; }
};

/**
 * Start the geofence / proximity task for any authenticated user.
 * Caches reverse-geocoded location text and fires store proximity notifications.
 * Battery-friendly: 50m / 60s interval.
 *
 * NOTE: Requires a dev/production build with UIBackgroundModes=location.
 * Returns { success: false, isExpoGo: true } when running inside Expo Go so
 * callers can fall back to foreground-only tracking.
 */
export const startGeofenceTracking = async (): Promise<{ success: boolean; message: string; isExpoGo?: boolean }> => {
  try {
    if (await isGeofenceRunning()) return { success: true, message: 'Already running' };

    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return { success: false, message: 'Foreground location permission denied' };

    // Best-effort background permission (task still works foreground-only if denied)
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      await Location.requestBackgroundPermissionsAsync().catch(() => {});
    }

    await Location.startLocationUpdatesAsync(TASK_LOCATION_GEOFENCE, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50,   // 50 m minimum movement before next update
      timeInterval: 60_000,   // 60 s maximum interval
      foregroundService: {
        notificationTitle: 'Shopyos',
        notificationBody: 'Finding nearby stores for you…',
        notificationColor: '#84cc16',
      },
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: true, // iOS: pause when stationary (saves battery)
    });

    console.log('[TaskController] Geofence tracking started');
    return { success: true, message: 'Geofence tracking started' };
  } catch (error: any) {
    const msg: string = error?.message ?? '';

    // Expo Go (and any build without UIBackgroundModes=location) throws this specific error.
    // Return a typed result so the caller can gracefully fall back to foreground polling.
    if (
      msg.includes('Background location has not been configured') ||
      msg.includes('UIBackgroundModes') ||
      msg.includes('BACKGROUND_LOCATION')
    ) {
      console.warn(
        '[TaskController] Background location unavailable (Expo Go or missing native config). ' +
        'Falling back to foreground-only tracking.'
      );
      return { success: false, message: msg, isExpoGo: true };
    }

    console.error('[TaskController] Failed to start geofence tracking:', error);
    return { success: false, message: msg || 'Failed to start geofence' };
  }
};

export const stopGeofenceTracking = async (): Promise<void> => {
  try {
    if (await isGeofenceRunning()) {
      await Location.stopLocationUpdatesAsync(TASK_LOCATION_GEOFENCE);
      console.log('[TaskController] Geofence tracking stopped');
    }
  } catch (error) {
    console.error('[TaskController] Error stopping geofence tracking:', error);
  }
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export const requestLocationPermissions = async (): Promise<{
  foreground: boolean;
  background: boolean;
}> => {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return { foreground: false, background: false };

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    return { foreground: true, background: bg === 'granted' };
  } catch {
    return { foreground: false, background: false };
  }
};

// ─── Preferences ─────────────────────────────────────────────────────────────

export const getLocationSharingPreference = async (): Promise<boolean> => {
  try {
    return (await storage.getItem('shareLiveLocation')) === 'true';
  } catch { return false; }
};

export const setLocationSharingPreference = async (enabled: boolean): Promise<void> => {
  try {
    await storage.setItem('shareLiveLocation', enabled ? 'true' : 'false');
  } catch (error) {
    console.error('[TaskController] Error setting location sharing preference:', error);
  }
};

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Ensures background tasks are in the correct state for the current user.
 * Call on login, logout, role change, and delivery start/end.
 *
 *  • TASK_LOCATION_GEOFENCE → managed by the hook directly (startGeofenceTracking is called
 *                             before this function, so we only handle stop-on-logout here)
 *  • TASK_DRIVER_LOCATION   → starts only for drivers with an active delivery + sharing on
 *
 * @param userState  current user state
 * @param skipGeofence  when true, skip starting geofence (hook already started/failed it)
 */
export const ensureBackgroundTasksForUser = async (
  userState: UserState,
  skipGeofence = false,
): Promise<void> => {
  try {
    console.log('[TaskController] Ensuring tasks for state:', userState);

    const { role, activeDeliveryId, shareLiveLocation, isAuthenticated } = userState;

    // ── Geofence (all users) ─────────────────────────────────────────────────
    if (!skipGeofence) {
      const geofenceRunning = await isGeofenceRunning();
      if (isAuthenticated && !geofenceRunning) {
        const res = await startGeofenceTracking();
        if (!res.success && !res.isExpoGo) {
          console.warn('[TaskController] Geofence start failed:', res.message);
        }
      } else if (!isAuthenticated && (await isGeofenceRunning())) {
        await stopGeofenceTracking();
      }
    } else if (!isAuthenticated) {
      // Even with skipGeofence, still stop it on logout
      if (await isGeofenceRunning()) await stopGeofenceTracking();
    }

    // ── Driver delivery tracking ─────────────────────────────────────────────
    const isDriver = role?.toLowerCase() === 'driver';
    const shouldTrack = isDriver && !!activeDeliveryId && shareLiveLocation === true;
    const isTracking = await isTrackingLocation();

    if (shouldTrack && !isTracking) {
      const res = await startDriverLocationTracking(activeDeliveryId!);
      if (!res.success) console.warn('[TaskController] Driver tracking start failed:', res.message);
    } else if (!shouldTrack && isTracking) {
      await stopDriverLocationTracking();
    }
  } catch (error) {
    console.error('[TaskController] Error in ensureBackgroundTasksForUser:', error);
  }
};
