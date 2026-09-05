// Coordinates the single iOS/Android audio session shared by every
// VoiceMessage playback bubble and the VoiceRecorder in a chat. Each
// component creates its own expo-audio AudioPlayer/AudioRecorder instance
// independently, so without this, two of them can fight over the native
// audio session — e.g. starting a recording while a voice note is still
// playing fails with AVAudioSessionErrorInsufficientPriority ("!pri"),
// and creating a second player while another is mid-load can cancel it
// ("Operation Stopped"). Only one voice player is ever allowed to hold
// the session at a time, and starting a recording always stops it first.
let activeStop: (() => void) | null = null;

export function setActiveVoicePlayer(stop: () => void): void {
  if (activeStop && activeStop !== stop) activeStop();
  activeStop = stop;
}

export function clearActiveVoicePlayer(stop: () => void): void {
  if (activeStop === stop) activeStop = null;
}

export function stopActiveVoicePlayer(): void {
  if (activeStop) {
    activeStop();
    activeStop = null;
  }
}
