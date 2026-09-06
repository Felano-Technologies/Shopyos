// services/callRingtone.ts
// Plays the bundled ringtone while a call is ringing — incoming (on the
// receiver's device) and outgoing/ringback (on the caller's device, while
// waiting for accept). Mirrors the createAudioPlayer pattern already used
// for notification sounds in hooks/useNotifications.ts.

import { createAudioPlayer } from 'expo-audio';

let player: ReturnType<typeof createAudioPlayer> | null = null;

export function startRingtone() {
  if (player) return; // already ringing
  try {
    player = createAudioPlayer(require('@/assets/sounds/ringtone.wav'));
    player.loop = true;
    player.volume = 0.8;
    player.play();
  } catch (err) {
    console.warn('Failed to play ringtone:', err);
    player = null;
  }
}

export function stopRingtone() {
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch {
    // best-effort
  }
  player = null;
}
