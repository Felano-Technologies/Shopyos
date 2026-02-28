/**
 * Location Queue for Offline Support
 * Stores location updates when offline and flushes them when connection is restored
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDriverLocation } from '@/services/api';

const QUEUE_KEY = 'LOCATION_QUEUE';

interface QueuedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  deliveryId: string;
}

/**
 * Add a location point to the queue
 */
export const enqueueLocation = async (
  latitude: number,
  longitude: number,
  deliveryId: string
): Promise<void> => {
  try {
    const existingQueue = await getQueue();
    const newPoint: QueuedLocation = {
      latitude,
      longitude,
      timestamp: Date.now(),
      deliveryId,
    };

    existingQueue.push(newPoint);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existingQueue));
    console.log('[LocationQueue] Queued location point. Queue size:', existingQueue.length);
  } catch (error) {
    console.error('[LocationQueue] Failed to enqueue location:', error);
  }
};

/**
 * Get all queued locations
 */
export const getQueue = async (): Promise<QueuedLocation[]> => {
  try {
    const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[LocationQueue] Failed to get queue:', error);
    return [];
  }
};

/**
 * Flush all queued locations to the backend
 * Should be called when connection is restored
 */
export const flushQueue = async (): Promise<void> => {
  try {
    const queue = await getQueue();
    if (queue.length === 0) {
      console.log('[LocationQueue] No queued locations to flush');
      return;
    }

    console.log('[LocationQueue] Flushing', queue.length, 'queued locations');

    // Send all queued locations
    const failedUpdates: QueuedLocation[] = [];
    for (const location of queue) {
      try {
        await updateDriverLocation(
          location.deliveryId,
          location.latitude,
          location.longitude
        );
      } catch (error) {
        console.error('[LocationQueue] Failed to send queued location:', error);
        failedUpdates.push(location);
      }
    }

    // Keep failed updates in queue
    if (failedUpdates.length > 0) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedUpdates));
      console.log('[LocationQueue] Kept', failedUpdates.length, 'failed updates in queue');
    } else {
      await clearQueue();
    }
  } catch (error) {
    console.error('[LocationQueue] Failed to flush queue:', error);
  }
};

/**
 * Clear all queued locations
 */
export const clearQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log('[LocationQueue] Queue cleared');
  } catch (error) {
    console.error('[LocationQueue] Failed to clear queue:', error);
  }
};
