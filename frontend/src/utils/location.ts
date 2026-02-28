/**
 * Location Utilities
 * Shared location functions used across the app
 */

import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { updateUserLocation } from '@/services/api';

/**
 * Request foreground location permission
 */
export const requestForegroundPermission = async (): Promise<boolean> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Location] Error requesting foreground permission:', error);
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
    console.error('[Location] Error getting current location:', error);
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
        Alert.alert(
          'Permission Denied',
          'Location permission is required to provide you with better service.'
        );
      }
      return null;
    }

    // Get current location
    const coords = await getCurrentLocation();
    if (!coords) {
      console.warn('[Location] Failed to get location');
      return null;
    }

    // Send to backend
    await updateUserLocation(coords.latitude, coords.longitude);
    console.log('[Location] User location updated successfully');

    return coords;
  } catch (error) {
    console.error('[Location] Error updating user location:', error);
    return null;
  }
};
