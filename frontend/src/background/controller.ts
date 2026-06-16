/**
 * Background Task Controller
 * Centralized logic for starting/stopping background tasks based on user state
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { storage } from '../../services/api';
import { TASK_DRIVER_LOCATION, TASK_LOCATION_GEOFENCE, PROXIMITY_RADIUS_METERS } from './taskNames';
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

    // Request background permission as a best-effort progressive enhancement
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      await Location.requestBackgroundPermissionsAsync().catch(() => {});
    }

    await storage.setItem('activeDeliveryId', deliveryId);

    await Location.startLocationUpdatesAsync(TASK_DRIVER_LOCATION, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      timeInterval: 30_000,
      foregroundService: {
        notificationTitle: 'Shopyos — Active Delivery',
        notificationBody: 'Your live location is being shared with the customer for real-time tracking.',
        notificationColor: '#0C1559',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    console.log('[TaskController] Driver location tracking started');
    return { success: true, message: 'Location tracking started' };
  } catch (error: any) {
    const msg: string = error?.message ?? '';
    if (
      msg.includes('Background location has not been configured') ||
      msg.includes('UIBackgroundModes') ||
      msg.includes('BACKGROUND_LOCATION')
    ) {
      console.log(
        '[TaskController] Background location tracking unavailable (Expo Go/simulator fallback active).'
      );
      return { success: true, message: 'Foreground fallback active (Expo Go)' };
    }
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
    await storage.removeItem('activeDeliveryId');
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
 * Start OS-native geofencing for store proximity alerts.
 * Reads the cached store list from AsyncStorage and registers each store as a
 * geofence region. The OS fires TASK_LOCATION_GEOFENCE only when the user
 * physically enters a region — no continuous polling, no foreground service,
 * no persistent notification.
 *
 * Call this after stores have been cached (i.e. from the cacheStores callback).
 * Safe to call repeatedly — stops any existing session before starting fresh
 * so the region list stays in sync with the latest store data.
 */
export const startGeofenceTracking = async (): Promise<{ success: boolean; message: string; isExpoGo?: boolean }> => {
  try {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') return { success: false, message: 'Foreground location permission denied' };

    const storeRaw = await storage.getItem('CACHED_STORES');
    if (!storeRaw) return { success: false, message: 'No stores cached yet — geofencing deferred' };

    const stores: { id: string; latitude: number | string; longitude: number | string }[] = JSON.parse(storeRaw);

    const regions = stores
      .map(s => ({
        identifier: s.id,
        latitude: typeof s.latitude === 'string' ? Number.parseFloat(s.latitude) : s.latitude,
        longitude: typeof s.longitude === 'string' ? Number.parseFloat(s.longitude) : s.longitude,
        radius: PROXIMITY_RADIUS_METERS,
        notifyOnEnter: true,
        notifyOnExit: false,
      }))
      .filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.latitude !== 0 && r.longitude !== 0);

    if (regions.length === 0) return { success: false, message: 'No valid store coordinates in cache' };

    // Stop first so we replace regions on refresh rather than append
    if (await isGeofenceRunning()) {
      await Location.stopGeofencingAsync(TASK_LOCATION_GEOFENCE);
    }

    await Location.startGeofencingAsync(TASK_LOCATION_GEOFENCE, regions);
    console.log(`[TaskController] Geofencing started for ${regions.length} stores`);
    return { success: true, message: `Geofencing started (${regions.length} stores)` };
  } catch (error: any) {
    const msg: string = error?.message ?? '';
    if (
      msg.includes('Background location has not been configured') ||
      msg.includes('UIBackgroundModes') ||
      msg.includes('BACKGROUND_LOCATION')
    ) {
      console.warn('[TaskController] OS geofencing unavailable (Expo Go). Foreground poll handles proximity.');
      return { success: false, message: msg, isExpoGo: true };
    }
    console.error('[TaskController] Failed to start geofencing:', error);
    return { success: false, message: msg || 'Failed to start geofencing' };
  }
};

export const stopGeofenceTracking = async (): Promise<void> => {
  try {
    if (await isGeofenceRunning()) {
      await Location.stopGeofencingAsync(TASK_LOCATION_GEOFENCE);
      console.log('[TaskController] Geofencing stopped');
    }
  } catch (error) {
    console.error('[TaskController] Error stopping geofencing:', error);
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
async function syncGeofence(isAuthenticated: boolean | undefined, skipGeofence: boolean): Promise<void> {
  if (!skipGeofence) {
    const geofenceRunning = await isGeofenceRunning();
    if (isAuthenticated && !geofenceRunning) {
      const res = await startGeofenceTracking();
      if (!res.success && !res.isExpoGo) {
        console.warn('[TaskController] Geofence start failed:', res.message);
      }
    } else if (!isAuthenticated && geofenceRunning) {
      await stopGeofenceTracking();
    }
  } else if (!isAuthenticated && (await isGeofenceRunning())) {
    await stopGeofenceTracking();
  }
}

async function syncDriverTracking(role: string | undefined, activeDeliveryId: string | null | undefined, shareLiveLocation: boolean | undefined): Promise<void> {
  const isDriver = role?.toLowerCase() === 'driver';
  const shouldTrack = isDriver && !!activeDeliveryId && shareLiveLocation === true;
  const isTracking = await isTrackingLocation();

  if (shouldTrack && !isTracking) {
    const deliveryId = activeDeliveryId as string;
    const res = await startDriverLocationTracking(deliveryId);
    if (!res.success) console.warn('[TaskController] Driver tracking start failed:', res.message);
  } else if (!shouldTrack && isTracking) {
    await stopDriverLocationTracking();
  }
}

export const ensureBackgroundTasksForUser = async (
  userState: UserState,
  skipGeofence = false,
): Promise<void> => {
  try {
    console.log('[TaskController] Ensuring tasks for state:', userState);
    const { role, activeDeliveryId, shareLiveLocation, isAuthenticated } = userState;
    await syncGeofence(isAuthenticated, skipGeofence);
    await syncDriverTracking(role, activeDeliveryId, shareLiveLocation);
  } catch (error) {
    console.error('[TaskController] Error in ensureBackgroundTasksForUser:', error);
  }
};
