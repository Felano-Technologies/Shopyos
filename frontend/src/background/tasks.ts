/**
 * Background Task Definitions
 * Define all TaskManager tasks here. Safe to import multiple times (idempotent).
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { TASK_DRIVER_LOCATION } from './taskNames';
import { updateDriverLocation } from '../../services/api';
import { enqueueLocation } from './queue';

/**
 * Driver Location Background Task
 * Runs in the background while driver has an active delivery
 */
TaskManager.defineTask(TASK_DRIVER_LOCATION, async ({ data, error }: any) => {
  if (error) {
    console.error('[BackgroundTask] TASK_DRIVER_LOCATION error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) {
      return;
    }

    // Get the most recent location
    const location = locations[locations.length - 1];
    const { latitude, longitude } = location.coords;

    console.log('[BackgroundTask] Driver location update:', {
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get delivery ID from async storage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const deliveryId = await AsyncStorage.getItem('activeDeliveryId');
      
      if (!deliveryId) {
        console.warn('[BackgroundTask] No active delivery ID found. Skipping location update.');
        return;
      }

      // Try to send location to backend
      await updateDriverLocation(deliveryId, latitude, longitude);
      console.log('[BackgroundTask] Location sent successfully');
    } catch (error: any) {
      console.error('[BackgroundTask] Failed to send location, queuing for later:', error.message);
      
      // Queue the location for retry when connection is restored
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const deliveryId = await AsyncStorage.getItem('activeDeliveryId');
        if (deliveryId) {
          await enqueueLocation(latitude, longitude, deliveryId);
        }
      } catch (queueError) {
        console.error('[BackgroundTask] Failed to queue location:', queueError);
      }
    }
  }
});
