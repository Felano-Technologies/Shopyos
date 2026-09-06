// services/callRecordingService.ts
// Thin wrapper around the react-native-agora RTC engine lifecycle, so
// CallScreen stays a dumb UI component.
//
// Component responsibilities:
//   - Agora RTC: live audio transport between the two participants.
//   - This module also starts/stops CLIENT-SIDE local recording (mixed
//     local+remote audio) during the call — Agora's own Cloud Recording
//     product is not used (see backend/utils/agora.js's header comment).
//   - The finished local recording file is hand off to
//     recordingUploadQueue.ts for the actual (retryable) upload to storage.
//
// react-native-agora has native (Android/iOS) code — it only works in a
// custom development build (EAS dev client / prebuild), never in Expo Go
// and never in an older dev client built before this dependency existed.
// Its own module does native-module lookups the moment it's imported, so a
// static `import ... from 'react-native-agora'` at the top of this file
// would crash the ENTIRE app on load (every screen, not just calling) on
// any client that doesn't have it linked yet. Deferring to a lazy require
// inside ensureAgora() means only an actual attempt to join/record a call
// fails (with a clear error) — everything else in the app keeps working.

import * as FileSystem from 'expo-file-system/legacy';
import type { IRtcEngine } from 'react-native-agora';

let AgoraModule: typeof import('react-native-agora') | null = null;
function getAgora(): typeof import('react-native-agora') {
  if (!AgoraModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AgoraModule = require('react-native-agora');
    } catch (err) {
      throw new Error(
        'In-app calling needs a development build with react-native-agora linked — it will not work in Expo Go or an older dev client. Rebuild via `eas build --profile development` (or `npx expo run:ios` / `run:android`) after this dependency was added.'
      );
    }
  }
  return AgoraModule!;
}

let engine: IRtcEngine | null = null;
let currentRecordingPath: string | null = null;
let lastHandler: Record<string, unknown> | null = null;

function ensureEngine(appId: string): IRtcEngine {
  if (engine) return engine;
  const { createAgoraRtcEngine, ChannelProfileType } = getAgora();
  engine = createAgoraRtcEngine();
  engine.initialize({ appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
  engine.enableAudio();
  return engine;
}

export type CallEngineHandlers = {
  onUserJoined?: () => void;
  onUserOffline?: () => void;
  onError?: (err: string) => void;
};

export function joinCall(params: { appId: string; token: string; channelName: string; uid: number }, handlers: CallEngineHandlers = {}) {
  const { ChannelProfileType, ClientRoleType } = getAgora();
  const eng = ensureEngine(params.appId);

  if (lastHandler) eng.unregisterEventHandler(lastHandler as any);
  const newHandler = {
    onUserJoined: () => handlers.onUserJoined?.(),
    onUserOffline: () => handlers.onUserOffline?.(),
    onError: (err: number, msg: string) => handlers.onError?.(`${err}: ${msg}`),
  };
  lastHandler = newHandler;
  eng.registerEventHandler(newHandler);

  eng.joinChannel(params.token, params.channelName, params.uid, {
    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    channelProfile: ChannelProfileType.ChannelProfileCommunication,
  });
}

export function muteLocalAudio(mute: boolean) {
  engine?.muteLocalAudioStream(mute);
}

// Voice calls default to the earpiece (like a phone call); this toggles to
// the loudspeaker, matching the standard in-call "speaker" button.
export function setSpeakerphoneEnabled(enabled: boolean) {
  engine?.setEnableSpeakerphone(enabled);
}

// Starts recording the mixed local+remote audio to a local file. Call once
// the channel join succeeds. Returns the local file path the recording will
// be written to (used later to hand off to the upload queue).
export function startLocalRecording(callId: string): string {
  if (!engine) throw new Error('Call engine not initialized');
  const { AudioFileRecordingType, AudioRecordingQualityType } = getAgora();
  const dir = `${FileSystem.documentDirectory}call-recordings/`;
  const filePath = `${dir}${callId}.aac`;
  currentRecordingPath = filePath;

  FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});

  engine.startAudioRecording({
    filePath,
    encode: true,
    fileRecordingType: AudioFileRecordingType.AudioFileRecordingMixed,
    quality: AudioRecordingQualityType.AudioRecordingQualityMedium,
    sampleRate: 32000,
  });

  return filePath;
}

// Stops recording and returns the local file path (or null if none was active).
export function stopLocalRecording(): string | null {
  const path = currentRecordingPath;
  if (engine && path) {
    engine.stopAudioRecording();
  }
  currentRecordingPath = null;
  return path;
}

export function leaveCall() {
  engine?.leaveChannel();
}

export function releaseEngine() {
  if (engine) {
    if (lastHandler) engine.unregisterEventHandler(lastHandler as any);
    lastHandler = null;
    engine.release();
    engine = null;
  }
}
