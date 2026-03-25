/**
 * Location Queue for Offline Support
 * Stores location updates when offline and flushes them when connection is restored
 */

import { updateDriverLocation, storage } from '../../services/api';

const QUEUE_KEY = 'LOCATION_QUEUE';
const MAX_QUEUE_SIZE = 50;

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
    
    // Keep only the most recent points to avoid storage overflow
    const trimmedQueue = existingQueue.slice(-MAX_QUEUE_SIZE);
    await storage.setItem(QUEUE_KEY, JSON.stringify(trimmedQueue));
  } catch (error) {
    console.error('[LocationQueue] Failed to enqueue location:', error);
  }
};

/**
 * Get all queued locations
 */
export const getQueue = async (): Promise<QueuedLocation[]> => {
  try {
    const queueJson = await storage.getItem(QUEUE_KEY);
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
      return;
    }


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
      await storage.setItem(QUEUE_KEY, JSON.stringify(failedUpdates));
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
    await storage.removeItem(QUEUE_KEY);
  } catch (error) {
    console.error('[LocationQueue] Failed to clear queue:', error);
  }
};
