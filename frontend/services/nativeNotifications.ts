// services/nativeNotifications.ts
// Marking something read in our own DB (a notification, a conversation) has
// never told the OS to remove the matching entry from the system
// notification tray — those are two entirely separate things: our own
// read/unread state, and whatever the OS is still displaying from when the
// push first arrived. This is what actually clears the tray entry.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGoUnsupportedPlatform = Constants.appOwnership === 'expo' && Platform.OS === 'android';

function getNotificationsModule(): any {
  if (isExpoGoUnsupportedPlatform) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// Dismisses only the currently-presented OS notification(s) whose data
// payload matches `predicate` — e.g. clearing just the tray entries for one
// conversation when it's read, not every notification the user has.
export async function dismissMatchingNotifications(predicate: (data: any) => boolean): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    const matches = (presented || []).filter((n: any) => predicate(n?.request?.content?.data || {}));
    await Promise.all(matches.map((n: any) => Notifications.dismissNotificationAsync(n.request.identifier)));
  } catch {
    // best-effort — tray cleanup must never break the actual mark-as-read flow
  }
}

export async function dismissAllNativeNotifications(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // best-effort
  }
}
