/**
 * Permission request helpers with Prominent Disclosure
 *
 * Each helper checks the existing permission status first (so an
 * already-granted permission never re-shows the disclosure), then shows an
 * in-app explanation via PermissionDisclosureHost before firing the actual
 * OS/library permission request — required by Google Play / App Store's
 * Prominent Disclosure and Consent policy.
 */
import * as ImagePicker from 'expo-image-picker';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';

// Each helper's custom modal is purely educational — Apple guideline 5.1.1(iv)
// requires the real system prompt to always follow it, so declining the
// in-app disclosure must not short-circuit to a synthetic "denied" without
// ever showing the OS dialog. The user's actual choice belongs at the system
// prompt, which still runs regardless of what they tap here.

export const requestCameraPermissionWithDisclosure = async (): Promise<{ status: ImagePicker.PermissionStatus }> => {
  const existing = await ImagePicker.getCameraPermissionsAsync();
  if (existing.status === ImagePicker.PermissionStatus.GRANTED) return existing;

  await requestPermissionDisclosure({
    icon: 'camera',
    title: 'Camera Access',
    description: 'Shopyos needs camera access so you can take photos to upload — for example product images, delivery proof, or verification documents.',
  });

  return await ImagePicker.requestCameraPermissionsAsync();
};

export const requestMediaLibraryPermissionWithDisclosure = async (): Promise<{ status: ImagePicker.PermissionStatus }> => {
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.status === ImagePicker.PermissionStatus.GRANTED) return existing;

  await requestPermissionDisclosure({
    icon: 'images',
    title: 'Photo Library Access',
    description: 'Shopyos needs access to your photos so you can choose images to upload — for example product photos, profile pictures, or documents.',
  });

  return await ImagePicker.requestMediaLibraryPermissionsAsync();
};

export const requestLocationPermissionWithDisclosure = async (): Promise<{ status: Location.PermissionStatus }> => {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === Location.PermissionStatus.GRANTED) return existing;

  await requestPermissionDisclosure({
    icon: 'location',
    title: 'Location Access',
    description: 'Shopyos uses your location to center the map on where you actually are, so you can pin your shop location without having to search for it manually.',
  });

  return await Location.requestForegroundPermissionsAsync();
};

export const requestMicrophonePermissionWithDisclosure = async (): Promise<{ status: string }> => {
  const existing = await getRecordingPermissionsAsync();
  if (existing.status === 'granted') return existing;

  await requestPermissionDisclosure({
    icon: 'mic',
    title: 'Microphone Access',
    description: 'Shopyos needs microphone access to record the voice notes you choose to send in chat.',
  });

  return await requestRecordingPermissionsAsync();
};

export const requestCallMicrophonePermissionWithDisclosure = async (): Promise<{ status: string }> => {
  const existing = await getRecordingPermissionsAsync();
  if (existing.status === 'granted') return existing;

  await requestPermissionDisclosure({
    icon: 'mic',
    title: 'Microphone Access',
    description: 'Shopyos needs microphone access so the other person on a call can hear you.',
  });

  return await requestRecordingPermissionsAsync();
};

export const requestNotificationPermissionWithDisclosure = async (): Promise<{ status: Notifications.PermissionStatus }> => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return existing;

  await requestPermissionDisclosure({
    icon: 'notifications',
    title: 'Notifications',
    description: 'Shopyos sends notifications for order updates, delivery status, chat messages, and deals. You can turn these off anytime in Settings.',
  });

  return await Notifications.requestPermissionsAsync();
};
