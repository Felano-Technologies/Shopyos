/**
 * Background Task Definitions
 * Define all TaskManager tasks here. Safe to import multiple times (idempotent).
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { TASK_DRIVER_LOCATION, TASK_LOCATION_GEOFENCE } from './taskNames';
import { updateDriverLocation, storage } from '../../services/api';
import { enqueueLocation } from './queue';

const isExpoGo = Constants.appOwnership === 'expo';

const getNotificationsModule = () => {
  if (isExpoGo) return null;
  return Notifications;
};

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

  const { latitude, longitude } = locations.at(-1)!.coords;
  console.log('[BackgroundTask] Driver location update:', { latitude, longitude, timestamp: new Date().toISOString() });

  try {
    const deliveryId = await storage.getItem('activeDeliveryId');
    if (!deliveryId) {
      console.warn('[BackgroundTask] No active delivery ID found. Skipping location update.');
      return;
    }
    await updateDriverLocation(deliveryId, latitude, longitude);
    console.log('[BackgroundTask] Location sent successfully');
  } catch (err: any) {
    console.error('[BackgroundTask] Failed to send location, queuing for later:', err.message);
    try {
      const deliveryId = await storage.getItem('activeDeliveryId');
      if (deliveryId) await enqueueLocation(latitude, longitude, deliveryId);
    } catch (queueError) {
      console.error('[BackgroundTask] Failed to queue location:', queueError);
    }
  }
});

// ─── TASK 2: OS-native geofencing (ALL authenticated users) ────────────────────
// Fires only when the user physically enters a store's region.
// The OS (CoreLocation on iOS, Geofencing API on Android) handles all distance
// math at the hardware level — no continuous polling, no foreground service,
// no persistent notification.
// Reverse-geocoding and backend location sync run in the foreground poll instead.

const COOLDOWN_PREFIX = 'GEOFENCE_NOTIF_';
const COOLDOWN_MS = 30 * 60 * 1000;

TaskManager.defineTask(TASK_LOCATION_GEOFENCE, async ({ data, error }: any) => {
  if (error) {
    console.error('[GeofenceTask] Error:', error);
    return;
  }
  if (!data) return;

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: { identifier: string };
  };

  // Only act on enter events
  if (eventType !== Location.GeofencingEventType.Enter) return;

  try {
    const storeRaw = await storage.getItem('CACHED_STORES');
    if (!storeRaw) return;

    const stores: { id: string; store_name: string }[] = JSON.parse(storeRaw);
    const store = stores.find(s => s.id === region.identifier);
    if (!store) return;

    const cooldownKey = `${COOLDOWN_PREFIX}${store.id}`;
    const lastStr = await storage.getItem(cooldownKey);
    const now = Date.now();
    if (lastStr && now - Number.parseInt(lastStr, 10) < COOLDOWN_MS) return;

    const Notifs = getNotificationsModule();
    if (!Notifs) return;

    await Notifs.scheduleNotificationAsync({
      content: {
        title: `${store.store_name} is nearby!`,
        body: `You just arrived near ${store.store_name}. Tap to explore!`,
        data: { screen: 'store', storeId: store.id },
        sound: true,
      },
      trigger: null,
    });
    await storage.setItem(cooldownKey, now.toString());
    console.log(`[GeofenceTask] Proximity alert → ${store.store_name}`);
  } catch (err) {
    console.warn('[GeofenceTask] Notification error:', err);
  }
});
