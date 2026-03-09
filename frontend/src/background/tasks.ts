/**
 * Background Task Definitions
 * Define all TaskManager tasks here. Safe to import multiple times (idempotent).
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { TASK_DRIVER_LOCATION, TASK_LOCATION_GEOFENCE, PROXIMITY_RADIUS_METERS } from './taskNames';
import { updateDriverLocation } from '../../services/api';
import { enqueueLocation } from './queue';

// ─── Haversine distance helper (returns metres) ────────────────────────────────
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

// ─── TASK 1: Driver delivery location tracking ─────────────────────────────────
// Only runs when a driver has an active delivery with location sharing enabled.
TaskManager.defineTask(TASK_DRIVER_LOCATION, async ({ data, error }: any) => {
  if (error) {
    console.error('[BackgroundTask] TASK_DRIVER_LOCATION error:', error);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const { latitude, longitude } = locations[locations.length - 1].coords;
  console.log('[BackgroundTask] Driver location update:', { latitude, longitude, timestamp: new Date().toISOString() });

  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const deliveryId = await AsyncStorage.getItem('activeDeliveryId');
    if (!deliveryId) {
      console.warn('[BackgroundTask] No active delivery ID found. Skipping location update.');
      return;
    }
    await updateDriverLocation(deliveryId, latitude, longitude);
    console.log('[BackgroundTask] Location sent successfully');
  } catch (err: any) {
    console.error('[BackgroundTask] Failed to send location, queuing for later:', err.message);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const deliveryId = await AsyncStorage.getItem('activeDeliveryId');
      if (deliveryId) await enqueueLocation(latitude, longitude, deliveryId);
    } catch (queueError) {
      console.error('[BackgroundTask] Failed to queue location:', queueError);
    }
  }
});

// ─── TASK 2: Geofence / Proximity (ALL authenticated users) ────────────────────
// On each location update this task:
//   1. Reverse-geocodes the position and caches it → home screen reads from cache, no stale location
//   2. POSTs the updated lat/lng to /auth/location → keeps backend user location current
//   3. Computes Haversine distance to every cached Shopyos store → fires a local
//      "you're near X store" notification with a 30-min per-store cooldown

const COOLDOWN_PREFIX = 'GEOFENCE_NOTIF_';
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

TaskManager.defineTask(TASK_LOCATION_GEOFENCE, async ({ data, error }: any) => {
  if (error) {
    console.error('[GeofenceTask] Error:', error);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  const { latitude, longitude } = locations[locations.length - 1].coords;
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;

  // 1. Reverse geocode + cache ─────────────────────────────────────────────────
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (place) {
      const { city, region, country } = place;
      const locationText = `${city ?? region ?? country ?? 'Unknown'}${country ? `, ${country}` : ''}`;
      await AsyncStorage.setItem('CACHED_LOCATION_TEXT', locationText);
      console.log('[GeofenceTask] Cached location text:', locationText);
    }
  } catch (geoErr) {
    console.warn('[GeofenceTask] Reverse geocode failed:', geoErr);
  }

  // 2. Update backend position ─────────────────────────────────────────────────
  try {
    const userToken = await AsyncStorage.getItem('userToken');
    if (userToken) {
      const axios = require('axios');
      // Pull the base URL from AsyncStorage where the app stores it on boot,
      // falling back to the env variable.
      const baseUrl =
        (await AsyncStorage.getItem('API_BASE_URL')) ||
        process.env.EXPO_PUBLIC_API_URL ||
        'https://shopyos-backend.onrender.com/api/v1';
      await axios.put(
        `${baseUrl}/auth/location`,
        { latitude, longitude },
        { headers: { Authorization: `Bearer ${userToken}` }, timeout: 8000 }
      );
    }
  } catch (locErr: any) {
    // Non-critical – don't let a network failure crash the whole task
    console.warn('[GeofenceTask] Backend location update skipped:', locErr?.message ?? locErr);
  }

  // 3. Proximity check ──────────────────────────────────────────────────────────
  try {
    const storeRaw = await AsyncStorage.getItem('CACHED_STORES');
    if (!storeRaw) return;

    const stores: { id: string; store_name: string; latitude: number | string; longitude: number | string }[] =
      JSON.parse(storeRaw);
    const now = Date.now();

    for (const store of stores) {
      const storeLat = typeof store.latitude === 'string' ? parseFloat(store.latitude) : store.latitude;
      const storeLon = typeof store.longitude === 'string' ? parseFloat(store.longitude) : store.longitude;
      if (!storeLat || !storeLon || isNaN(storeLat) || isNaN(storeLon)) continue;

      const dist = haversineMetres(latitude, longitude, storeLat, storeLon);
      if (dist > PROXIMITY_RADIUS_METERS) continue;

      // Per-store cooldown
      const cooldownKey = `${COOLDOWN_PREFIX}${store.id}`;
      const lastStr = await AsyncStorage.getItem(cooldownKey);
      if (lastStr && now - parseInt(lastStr, 10) < COOLDOWN_MS) continue;

      // Fire local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${store.store_name} is nearby!`,
          body: `You're within ${Math.round(dist)}m of ${store.store_name}. Tap to explore!`,
          data: { screen: 'store', storeId: store.id },
          sound: true,
        },
        trigger: null, // fire immediately
      });
      await AsyncStorage.setItem(cooldownKey, now.toString());
      console.log(`[GeofenceTask] Proximity alert → ${store.store_name} (${Math.round(dist)}m)`);
    }
  } catch (proximityErr) {
    console.warn('[GeofenceTask] Proximity check error:', proximityErr);
  }
});
