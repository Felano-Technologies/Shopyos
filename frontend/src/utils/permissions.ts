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
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { requestPermissionDisclosure } from '@/components/PermissionDisclosureHost';

export const requestCameraPermissionWithDisclosure = async (): Promise<{ status: ImagePicker.PermissionStatus }> => {
  const existing = await ImagePicker.getCameraPermissionsAsync();
  if (existing.status === ImagePicker.PermissionStatus.GRANTED) return existing;

  const consented = await requestPermissionDisclosure({
    icon: 'camera',
    title: 'Camera Access',
    description: 'Shopyos needs camera access so you can take photos to upload — for example product images, delivery proof, or verification documents.',
  });
  if (!consented) return { status: ImagePicker.PermissionStatus.DENIED };

  return await ImagePicker.requestCameraPermissionsAsync();
};

export const requestMediaLibraryPermissionWithDisclosure = async (): Promise<{ status: ImagePicker.PermissionStatus }> => {
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.status === ImagePicker.PermissionStatus.GRANTED) return existing;

  const consented = await requestPermissionDisclosure({
    icon: 'images',
    title: 'Photo Library Access',
    description: 'Shopyos needs access to your photos so you can choose images to upload — for example product photos, profile pictures, or documents.',
  });
  if (!consented) return { status: ImagePicker.PermissionStatus.DENIED };

  return await ImagePicker.requestMediaLibraryPermissionsAsync();
};

export const requestMicrophonePermissionWithDisclosure = async (): Promise<{ status: string }> => {
  const existing = await Audio.getPermissionsAsync();
  if (existing.status === 'granted') return existing;

  const consented = await requestPermissionDisclosure({
    icon: 'mic',
    title: 'Microphone Access',
    description: 'Shopyos needs microphone access to record the voice notes you choose to send in chat.',
  });
  if (!consented) return { status: 'denied' };

  return await Audio.requestPermissionsAsync();
};

export const requestNotificationPermissionWithDisclosure = async (): Promise<{ status: Notifications.PermissionStatus }> => {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return existing;

  const consented = await requestPermissionDisclosure({
    icon: 'notifications',
    title: 'Notifications',
    description: 'Shopyos sends notifications for order updates, delivery status, chat messages, and deals. You can turn these off anytime in Settings.',
  });
  if (!consented) return { status: 'denied' as Notifications.PermissionStatus };

  return await Notifications.requestPermissionsAsync();
};
