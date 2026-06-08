/**
 * Custom hook to manage background tasks based on auth and delivery state.
 *
 * Two-layer approach (no persistent OS notification for regular users):
 *  1. TASK_LOCATION_GEOFENCE native task — starts without a foreground service, so
 *     Android shows no persistent notification. Fires reliably on iOS background;
 *     on Android it runs best-effort while the app is alive.
 *  2. Foreground poll (every 60 s) — always runs while the app is active, on all
 *     builds including Expo Go. Handles reverse-geocoding, backend location sync,
 *     and proximity notifications while the screen is on.
 *
 * TASK_DRIVER_LOCATION still uses a foreground service (and its notification) but
 * only for drivers with an active delivery — which is expected and correct.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import axios from 'axios';
import { getUserData, getAllStores, storage, secureStorage, API_URL } from '@/services/api';
import { useActiveDeliveries } from './useDelivery';
import {
  ensureBackgroundTasksForUser,
  getLocationSharingPreference,
  stopDriverLocationTracking,
  stopGeofenceTracking,
  startGeofenceTracking,
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
const isExpoGo = Constants.appOwnership === 'expo';

const getNotificationsModule = () => {
  if (isExpoGo) return null;
  return require('expo-notifications');
};

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
        await storage.setItem('CACHED_LOCATION_TEXT', text);
      }
    } catch { /* non-critical */ }

    // 2. Update backend position
    try {
      const userToken = await secureStorage.getItem('userToken');
      if (userToken) {
        await axios.put(
          `${API_URL}auth/location`,
          { latitude, longitude },
          { headers: { Authorization: `Bearer ${userToken}` }, timeout: 8000 }
        );
      }
    } catch { /* non-critical */ }

    // 3. Proximity check
    const storeRaw = await storage.getItem('CACHED_STORES');
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
      const last = await storage.getItem(cooldownKey);
      if (last && now - parseInt(last, 10) < COOLDOWN_MS) continue;

      const Notifications = getNotificationsModule();
      if (!Notifications) {
        continue;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${store.store_name} is nearby!`,
          body: `You're within ${Math.round(dist)}m of ${store.store_name}. Tap to explore!`,
          data: { screen: 'store', storeId: store.id },
          sound: true,
        },
        trigger: null,
      });
      await storage.setItem(cooldownKey, now.toString());
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

  // ── Cache the store list and (re)start OS geofencing ────────────────────
  useEffect(() => {
    if (!userData) return;

    const cacheStoresAndGeofence = async () => {
      try {
        const res = await getAllStores({ limit: 200 } as any);
        const stores = res.businesses || [];
        const slim = stores.map((s: any) => ({
          id: s.id,
          store_name: s.store_name || s.name || 'Shopyos Store',
          latitude: s.latitude,
          longitude: s.longitude,
        }));
        await storage.setItem('CACHED_STORES', JSON.stringify(slim));
        console.log('[BackgroundTasks] Cached', slim.length, 'stores');

        // (Re)start geofencing with the fresh store list. Calling this after
        // every cache refresh keeps the monitored regions in sync with new stores.
        const result = await startGeofenceTracking();
        if (!result.success && !result.isExpoGo) {
          console.warn('[BackgroundTasks] Geofencing start failed:', result.message);
        }
      } catch (err) {
        console.warn('[BackgroundTasks] Failed to cache stores:', err);
      }
    };

    cacheStoresAndGeofence();
    const interval = setInterval(cacheStoresAndGeofence, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userData, userData?.id]);

  // ── Start / stop tasks whenever user state changes ───────────────────────
  useEffect(() => {
    const checkAndUpdateTasks = async () => {
      if (!userData) {
        // Logged out → stop everything
        stopForegroundPoll();
        await stopGeofenceTracking();
        await stopDriverLocationTracking();
        return;
      }

      const role = userData.role?.toLowerCase();
      const activeDelivery = activeDeliveriesData?.deliveries?.[0];
      const activeDeliveryId = activeDelivery?.id || null;
      const shareLiveLocation = await getLocationSharingPreference();

      // Geofencing is started/refreshed by cacheStoresAndGeofence (above) so it
      // always has up-to-date store regions. Start the foreground poll here so
      // reverse-geocoding and backend location sync run while the app is active.
      startForegroundPoll();

      // Handle driver delivery tracking (skipGeofence=true — geofence is managed above)
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
    console.log('[BackgroundTasks] Starting foreground geofence poll');
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
        startForegroundPoll();
      } else if (nextAppState.match(/inactive|background/)) {
        stopForegroundPoll();
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
