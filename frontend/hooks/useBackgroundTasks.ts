/**
 * Custom hook to manage background tasks based on auth and delivery state.
 *
 * Background tasks (via expo-task-manager) require a DEV or PRODUCTION build.
 * When running in Expo Go the background task will fail with a "Background location
 * has not been configured" error. In that case this hook automatically falls back to
 * a foreground-only polling mode:
 *   - Polls position every 60 s using getCurrentPositionAsync
 *   - Runs the same proximity + location-cache logic in the foreground
 *   - Stops polling when the app goes to background (no native background process)
 *
 * In a real build the native TASK_LOCATION_GEOFENCE task takes over and runs even
 * when the screen is off.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getUserData, getAllStores } from '@/services/api';
import { useActiveDeliveries } from './useDelivery';
import {
  ensureBackgroundTasksForUser,
  getLocationSharingPreference,
  stopDriverLocationTracking,
  stopGeofenceTracking,
  startGeofenceTracking,
  isGeofenceRunning,
} from '@/src/background/controller';
import { flushQueue } from '@/src/background/queue';
import { PROXIMITY_RADIUS_METERS } from '@/src/background/taskNames';

// ─── Helpers shared with the background task ────────────────────────────────
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COOLDOWN_PREFIX = 'GEOFENCE_NOTIF_';
const COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Runs the same logic as TASK_LOCATION_GEOFENCE but in the foreground.
 * Used as a fallback when background tasks are unavailable (Expo Go).
 */
async function runForegroundGeofenceCheck() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const { coords: { latitude, longitude } } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // 1. Cache reverse-geocoded location text
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const { city, region, country } = place;
        const text = `${city ?? region ?? country ?? 'Unknown'}${country ? `, ${country}` : ''}`;
        await AsyncStorage.setItem('CACHED_LOCATION_TEXT', text);
      }
    } catch { /* non-critical */ }

    // 2. Proximity check
    const storeRaw = await AsyncStorage.getItem('CACHED_STORES');
    if (!storeRaw) return;
    const stores: { id: string; store_name: string; latitude: number | string; longitude: number | string }[] =
      JSON.parse(storeRaw);
    const now = Date.now();

    for (const store of stores) {
      const sLat = typeof store.latitude === 'string' ? parseFloat(store.latitude) : store.latitude;
      const sLon = typeof store.longitude === 'string' ? parseFloat(store.longitude) : store.longitude;
      if (!sLat || !sLon || isNaN(sLat) || isNaN(sLon)) continue;

      const dist = haversineMetres(latitude, longitude, sLat, sLon);
      if (dist > PROXIMITY_RADIUS_METERS) continue;

      const cooldownKey = `${COOLDOWN_PREFIX}${store.id}`;
      const last = await AsyncStorage.getItem(cooldownKey);
      if (last && now - parseInt(last, 10) < COOLDOWN_MS) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${store.store_name} is nearby!`,
          body: `You're within ${Math.round(dist)}m of ${store.store_name}. Tap to explore!`,
          data: { screen: 'store', storeId: store.id },
          sound: true,
        },
        trigger: null,
      });
      await AsyncStorage.setItem(cooldownKey, now.toString());
      console.log(`[ForegroundGeofence] Proximity alert → ${store.store_name} (${Math.round(dist)}m)`);
    }
  } catch (err) {
    console.warn('[ForegroundGeofence] Check failed:', err);
  }
}

// ────────────────────────────────────────────────────────────────────────────

export const useBackgroundTasks = () => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const foregroundPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isExpoGoMode = useRef(false);

  // Fetch user data to determine role and auth status
  const { data: userData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getUserData,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch active deliveries (only relevant if user is a driver)
  const { data: activeDeliveriesData } = useActiveDeliveries({
    enabled: userData?.role?.toLowerCase() === 'driver',
    refetchInterval: 30_000,
  });

  // ── Cache the store list for proximity checks ────────────────────────────
  useEffect(() => {
    if (!userData) return;

    const cacheStores = async () => {
      try {
        const res = await getAllStores({ limit: 200 } as any);
        const stores = res.businesses || [];
        const slim = stores.map((s: any) => ({
          id: s.id,
          store_name: s.store_name || s.name || 'Shopyos Store',
          latitude: s.latitude,
          longitude: s.longitude,
        }));
        await AsyncStorage.setItem('CACHED_STORES', JSON.stringify(slim));
        console.log('[BackgroundTasks] Cached', slim.length, 'stores for proximity checks');
      } catch (err) {
        console.warn('[BackgroundTasks] Failed to cache stores:', err);
      }
    };

    cacheStores();
    const interval = setInterval(cacheStores, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userData?.id]);

  // ── Start / stop tasks whenever user state changes ───────────────────────
  useEffect(() => {
    const checkAndUpdateTasks = async () => {
      if (!userData) {
        // Logged out → stop everything
        stopForegroundPoll();
        await stopGeofenceTracking();
        await stopDriverLocationTracking();
        isExpoGoMode.current = false;
        return;
      }

      const role = userData.role?.toLowerCase();
      const activeDelivery = activeDeliveriesData?.deliveries?.[0];
      const activeDeliveryId = activeDelivery?.id || null;
      const shareLiveLocation = await getLocationSharingPreference();

      // Try background task first
      const geofenceResult = await startGeofenceTracking();

      if (geofenceResult.isExpoGo) {
        // ── Expo Go / no native background support → foreground polling ──────
        isExpoGoMode.current = true;
        startForegroundPoll();
      } else {
        // ── Native build: background task is now running ─────────────────────
        isExpoGoMode.current = false;
        stopForegroundPoll(); // just in case it was running from a previous hot reload
      }

      // Driver delivery tracking is always attempted as a separate task
      // skipGeofence=true because we already called startGeofenceTracking above
      await ensureBackgroundTasksForUser({
        role,
        activeDeliveryId,
        shareLiveLocation,
        isAuthenticated: true,
      }, true);
    };

    checkAndUpdateTasks();
  }, [userData, activeDeliveriesData]);

  // ── Foreground poll helpers ────────────────────────────────────────────────
  const startForegroundPoll = () => {
    if (foregroundPollRef.current) return; // already running
    console.log('[BackgroundTasks] Starting foreground geofence poll (Expo Go mode)');
    // Run immediately, then every 60 s
    runForegroundGeofenceCheck();
    foregroundPollRef.current = setInterval(runForegroundGeofenceCheck, 60_000);
  };

  const stopForegroundPoll = () => {
    if (foregroundPollRef.current) {
      clearInterval(foregroundPollRef.current);
      foregroundPollRef.current = null;
      console.log('[BackgroundTasks] Foreground geofence poll stopped');
    }
  };

  // ── Pause/resume foreground poll with app state ──────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[BackgroundTasks] App foregrounded — flushing location queue');
        await flushQueue();
        // Resume foreground polling if we're in Expo Go mode
        if (isExpoGoMode.current) startForegroundPoll();
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background — pause foreground poll (it can't run anyway)
        if (isExpoGoMode.current) stopForegroundPoll();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopForegroundPoll();
      stopDriverLocationTracking();
      // Intentionally do NOT stop geofence background task on unmount —
      // it should survive re-renders. It is stopped only on logout.
    };
  }, []);
};
