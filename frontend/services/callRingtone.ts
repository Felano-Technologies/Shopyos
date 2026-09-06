// services/callRingtone.ts
// Plays the bundled ringtone while a call is ringing — incoming (on the
// receiver's device) and outgoing/ringback (on the caller's device, while
// waiting for accept). Mirrors the createAudioPlayer pattern already used
// for notification sounds in hooks/useNotifications.ts.
//
// Silent-switch behavior deliberately differs by direction, matching how a
// real phone call behaves:
//   - Outgoing (you placed the call): the ringback always plays audibly —
//     you're actively using the phone right now, so silent mode shouldn't
//     mute your own feedback that the call is ringing.
//   - Incoming: respects the phone's silent switch (no audio if silenced —
//     someone silenced their phone on purpose), but always vibrates so
//     there's still a physical cue.

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Vibration } from 'react-native';

const VIBRATION_PATTERN = [0, 700, 500]; // wait, vibrate, pause — repeats

let player: ReturnType<typeof createAudioPlayer> | null = null;
let vibrating = false;

export async function startRingtone({ ignoreSilentMode = false, vibrate = false }: { ignoreSilentMode?: boolean; vibrate?: boolean } = {}) {
  if (vibrate && !vibrating) {
    vibrating = true;
    Vibration.vibrate(VIBRATION_PATTERN, true);
  }

  if (player) return; // already ringing
  try {
    if (ignoreSilentMode) {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
    player = createAudioPlayer(require('@/assets/sounds/ringtone.wav'));
    player.loop = true;
    player.volume = 0.4;
    player.play();
  } catch (err) {
    console.warn('Failed to play ringtone:', err);
    player = null;
  }
}

export function stopRingtone() {
  if (vibrating) {
    Vibration.cancel();
    vibrating = false;
  }
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch {
    // best-effort
  }
  player = null;
}
