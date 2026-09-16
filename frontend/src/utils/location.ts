/**
 * Location Utilities
 * Shared location functions used across the app
 */

import * as Location from 'expo-location';
import { updateUserLocation } from '../../services/api';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';

/**
 * Request foreground location permission, showing an in-app disclosure of
 * what it's used for first (Prominent Disclosure requirement) unless the
 * permission is already granted.
 */
export const requestForegroundLocationWithDisclosure = async (): Promise<{ status: Location.PermissionStatus }> => {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === Location.PermissionStatus.GRANTED) return existing;

  // The custom disclosure is purely educational — Apple guideline 5.1.1(iv)
  // requires the real system prompt to always follow it, so "not now" must
  // still lead to the OS dialog rather than short-circuiting to a synthetic
  // denial. The user's actual choice belongs at the system prompt, not here.
  await requestPermissionDisclosure({
    icon: 'location',
    title: 'Location Access',
    description: 'Shopyos uses your location to show nearby stores, calculate accurate delivery fees, and provide delivery tracking. You can change this anytime in Settings.',
  });

  return await Location.requestForegroundPermissionsAsync();
};

/**
 * Request foreground location permission
 */
export const requestForegroundPermission = async (): Promise<boolean> => {
  try {
    const { status } = await requestForegroundLocationWithDisclosure();
    return status === 'granted';
  } catch (error) {
    if (__DEV__) console.error('[Location] Error requesting foreground permission:', error);
    return false;
  }
};

/**
 * Get current position once (foreground)
 */
export const getCurrentLocation = async (): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    if (__DEV__) console.error('[Location] Error getting current location:', error);
    return null;
  }
};

/**
 * Update user location once (used on login and app foreground)
 * This is the shared function that replaces the location logic in login screen
 */
export const updateUserLocationOnce = async (showAlert: boolean = true): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  try {
    // Request permission
    const hasPermission = await requestForegroundPermission();
    if (!hasPermission) {
      if (showAlert) {
        CustomInAppToast.show({ type: 'error', title: 'Permission Denied', message: 'Location permission is required to provide you with better service.' });
      }
      return null;
    }

    // Get current location
    const coords = await getCurrentLocation();
    if (!coords) {
      if (__DEV__) console.warn('[Location] Failed to get location');
      return null;
    }

    // Send to backend
    await updateUserLocation(coords.latitude, coords.longitude);
    if (__DEV__) console.log('[Location] User location updated successfully');

    return coords;
  } catch (error) {
    if (__DEV__) console.error('[Location] Error updating user location:', error);
    return null;
  }
};
