// services/voipCallKeepService.ts
// Bridges native CallKit (iOS) / ConnectionService (Android) ringing —
// via react-native-callkeep — and PushKit VoIP push delivery — via
// react-native-voip-push-notification — into the same callStore/REST flow
// the in-app IncomingCallModal/CallScreen already use. This is what makes
// an incoming call ring even while the app is backgrounded or fully killed;
// see plugins/withVoipPushKit.js for the native AppDelegate half of this on
// iOS (PushKit delegate methods can't be JS-only — Apple requires reporting
// to CallKit synchronously inside that native callback).
//
// Call once at app root (app/_layout.tsx), alongside where useCallListener
// is mounted. Both native modules are lazily required so importing this
// file never crashes a dev client built before these dependencies existed
// (same pattern as services/callRecordingService.ts for react-native-agora).
//
// KNOWN GAP (see plugins/withVoipPushKit.js and the plan): the Android
// "wake a fully killed process on FCM data message" path below uses
// expo-notifications' TaskManager-based background task, which has not
// been verified against a real killed-process delivery in this environment
// (no device/build tooling available here). If real-device testing shows
// it's unreliable, the documented fallback is adding
// @react-native-firebase/messaging and using its setBackgroundMessageHandler,
// which is a guaranteed headless-JS wake for FCM data messages.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from './client';
import { useCallStore } from '@/store/callStore';
import { acceptCall, rejectCall, endCall } from './calls';

// Expo Go can never run these native modules (no amount of try/catch
// changes that — accessing an unregistered native module throws RN's own
// "Invariant Violation" the moment the library's JS touches NativeModules,
// which surfaces as a scary-looking red box even though it's non-fatal and
// expected here) — same constraint react-native-agora already has. Bail
// out before ever requiring either library so Expo Go stays quiet.
const isExpoGo = Constants.appOwnership === 'expo';

const BACKGROUND_NOTIFICATION_TASK = 'VOIP_INCOMING_CALL_TASK';

let initialized = false;

function getCallKeep(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-callkeep').default;
  } catch {
    return null; // native module not linked yet — needs a rebuilt dev client
  }
}

function getVoipPush(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-voip-push-notification').default;
  } catch {
    return null;
  }
}

async function registerVoipTokenWithBackend(token: string, platform: 'ios' | 'android') {
  try {
    await api.post('/notifications/voip-push-token', { token, platform, deviceName: 'Mobile App' });
  } catch (err: any) {
    console.warn('[VoipCallKeep] Failed to register VoIP push token:', err?.message || err);
  }
}

// A VoIP push arrived — matches useCallListener's handleIncoming exactly
// (token/appId are minted only on accept, never carried in the push itself).
function handleIncomingPayload(payload: any) {
  if (!payload?.callId) return;
  if (useCallStore.getState().phase !== 'idle') return; // already on a call — let it ring out server-side (status: missed)
  useCallStore.getState().setIncoming({
    callId: payload.callId,
    channelName: payload.channelName,
    token: '',
    appId: '',
    otherUserId: payload.callerId,
    otherUserName: payload.callerName || 'Unknown caller',
    otherUserAvatar: payload.callerAvatar || null,
    orderId: null,
  });
}

// Native CallKit/ConnectionService answered — reuses the exact same
// accept-call REST call + store transition IncomingCallModal.handleAccept
// uses, so CallScreen renders/joins Agora identically regardless of which
// UI (native lock-screen or in-app modal) the user actually answered from.
async function handleNativeAnswer(callUUID: string, RNCallKeep: any) {
  try {
    const accepted = await acceptCall(callUUID);
    useCallStore.getState().setAccepted(accepted.startedAt || new Date().toISOString(), { token: accepted.token, appId: accepted.appId });
  } catch (err: any) {
    console.warn('[VoipCallKeep] Native answerCall failed:', err?.message || err);
    RNCallKeep?.endCall(callUUID);
    useCallStore.getState().reset();
  }
}

async function handleNativeEnd(callUUID: string) {
  const { call, phase } = useCallStore.getState();
  try {
    if (call?.callId === callUUID) {
      if (phase === 'ringing_incoming') await rejectCall(callUUID);
      else await endCall(callUUID);
    }
  } catch {
    // best-effort — reset locally regardless
  } finally {
    useCallStore.getState().reset();
  }
}

// Android: registered once so the OS can invoke this even if the app
// process was killed (expo-notifications' background task contract) —
// displays the native ConnectionService incoming-call UI directly from the
// high-priority FCM data message, without needing a live JS/React tree.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || Platform.OS !== 'android' || isExpoGo) return;
  const payload = (data as any)?.notification?.request?.content?.data;
  if (!payload?.callId) return;
  const RNCallKeep = getCallKeep();
  RNCallKeep?.displayIncomingCall(payload.callId, payload.callId, payload.callerName || 'Unknown caller', 'generic', false);
});

export async function initVoipCallKeep() {
  if (initialized) return;
  initialized = true;

  if (isExpoGo) {
    console.log('[VoipCallKeep] Running in Expo Go — native calling/VoIP push needs a dev-client build, skipping.');
    return;
  }

  const RNCallKeep = getCallKeep();
  if (!RNCallKeep) {
    console.warn('[VoipCallKeep] react-native-callkeep native module not available — needs a rebuilt dev client.');
    return;
  }

  try {
    await RNCallKeep.setup({
      ios: {
        appName: 'Shopyos',
        supportsVideo: false,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
      },
      android: {
        alertTitle: 'Phone account permission',
        alertDescription: 'Shopyos needs phone account access to show incoming calls when the app is in the background.',
        cancelButton: 'Cancel',
        okButton: 'OK',
        selfManaged: true,
        foregroundService: {
          channelId: 'calls',
          channelName: 'Calls',
          notificationTitle: 'Shopyos is handling a call',
        },
      },
    });
  } catch (err: any) {
    console.warn('[VoipCallKeep] setup failed:', err?.message || err);
  }

  RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => handleNativeAnswer(callUUID, RNCallKeep));
  RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => handleNativeEnd(callUUID));

  // Replay any native call events that fired before this listener attached
  // (e.g. the app was launched BY the incoming call itself).
  try {
    const initialCallKeepEvents = await RNCallKeep.getInitialEvents();
    for (const evt of initialCallKeepEvents || []) {
      if (evt.name === 'RNCallKeepPerformAnswerCallAction') handleNativeAnswer((evt.data as any).callUUID, RNCallKeep);
      if (evt.name === 'RNCallKeepPerformEndCallAction') handleNativeEnd((evt.data as any).callUUID);
    }
    RNCallKeep.clearInitialEvents();
  } catch {
    // best-effort
  }

  if (Platform.OS === 'ios') {
    const RNVoipPushNotification = getVoipPush();
    if (!RNVoipPushNotification) {
      console.warn('[VoipCallKeep] react-native-voip-push-notification native module not available — needs a rebuilt dev client.');
      return;
    }

    RNVoipPushNotification.addEventListener('register', (token: string) => registerVoipTokenWithBackend(token, 'ios'));
    RNVoipPushNotification.addEventListener('notification', (payload: any) => handleIncomingPayload(payload));
    RNVoipPushNotification.addEventListener('didLoadWithEvents', (events: any[]) => {
      for (const evt of events || []) {
        if (evt.name === 'RNVoipPushRemoteNotificationsRegisteredEvent') registerVoipTokenWithBackend(evt.data, 'ios');
        if (evt.name === 'RNVoipPushRemoteNotificationReceivedEvent') handleIncomingPayload(evt.data);
      }
    });

    RNVoipPushNotification.registerVoipToken();
  } else {
    // Android has no PushKit equivalent — the raw FCM registration token
    // doubles as the "VoIP" token here; the backend sends it a
    // high-priority data message directly instead of going through Expo's
    // push relay (see backend/services/voipPushService.js).
    try {
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      if (devicePushToken?.data) await registerVoipTokenWithBackend(String(devicePushToken.data), 'android');
    } catch (err: any) {
      console.warn('[VoipCallKeep] Failed to get Android device push token:', err?.message || err);
    }

    try {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    } catch (err: any) {
      console.warn('[VoipCallKeep] Failed to register background notification task:', err?.message || err);
    }
  }
}
