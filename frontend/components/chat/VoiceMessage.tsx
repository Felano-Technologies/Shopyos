import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { setActiveVoicePlayer, clearActiveVoicePlayer } from '@/services/voiceAudioSession';

interface VoiceMessageProps {
  url: string;
  durationMs?: number;
  isMe: boolean;
}

const NUM_BARS = 24;

export default function VoiceMessage({ url, durationMs = 0, isMe }: Readonly<VoiceMessageProps>) {
  // Creates the player immediately and starts loading the source right away
  // (per expo-audio's own docs) — the message bubble renders well before
  // anyone taps play, so this buffering happens invisibly in the background
  // instead of after the tap. useAudioPlayerStatus is expo-audio's own
  // recommended way to get reliable, continuously-ticking playback status —
  // the previous hand-rolled `addListener('playbackStatusUpdate', ...)`
  // approach never reliably delivered ongoing position/finished updates,
  // which is why the time stayed frozen and the icon never reverted to
  // "play" once a track finished.
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  // Stable across the player's lifetime — voiceAudioSession compares this
  // by reference to know which voice message currently owns the shared
  // audio session.
  const stopSelfRef = useRef(() => player.pause());

  // Generate a stable pseudo-random waveform shape from the URL
  const waveHeights = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < url.length; i++) {
      seed = Math.trunc((seed << 5) - seed + (url.codePointAt(i) ?? 0));
    }
    return Array.from({ length: NUM_BARS }, (_, i) => {
      seed = (seed * 16807 + 13) % 2147483647;
      const r = (seed & 0xffff) / 0xffff;
      // Create a natural wave pattern: higher in the middle, lower at edges
      const bellCurve = Math.sin((i / NUM_BARS) * Math.PI);
      const height = 4 + (r * 0.6 + bellCurve * 0.4) * 22;
      return height;
    });
  }, [url]);

  // Entrance animation
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [scaleAnim]);

  // Playback mode only needs setting once, ahead of any actual play() call —
  // the player already starts loading on mount, well before that.
  useEffect(() => {
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }, []);

  // Keeps the "only one voice message plays at a time" coordinator in sync
  // with the player's REAL state (not a manually-tracked isPlaying flag) —
  // registers this player as the active one whenever it's actually playing,
  // and releases that claim the moment it stops for any reason (paused,
  // finished, or force-stopped by another voice message/a recording start).
  useEffect(() => {
    if (status.playing) {
      setActiveVoicePlayer(stopSelfRef.current);
    } else {
      clearActiveVoicePlayer(stopSelfRef.current);
    }
  }, [status.playing]);

  // Reset to the start once finished so the NEXT tap replays from 0 instead
  // of immediately re-triggering "finished" at the end of the track.
  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  useEffect(() => {
    return () => clearActiveVoicePlayer(stopSelfRef.current);
  }, []);

  const handlePlayPause = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Falls back to the server-reported duration until the player's own
  // duration is known (right after mount, before loading completes).
  const displayDurationMs = status.duration > 0 ? status.duration * 1000 : durationMs;
  const positionMs = status.currentTime * 1000;
  const progressFraction = displayDurationMs > 0 ? positionMs / displayDurationMs : 0;
  const isLoading = !status.isLoaded && !status.error;

  const meActive = isMe ? '#fff' : '#84cc16';
  const meInactive = isMe ? 'rgba(255,255,255,0.25)' : 'rgba(12,21,89,0.15)';
  const mePlayBtnBg = isMe ? 'rgba(255,255,255,0.2)' : '#84cc16';
  const mePlayIcon = '#fff';
  const meTimeColor = isMe ? 'rgba(255,255,255,0.5)' : '#64748B';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {/* Play button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={isLoading}
        style={[styles.playBtn, { backgroundColor: mePlayBtnBg }]}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={mePlayIcon} />
        ) : (
          <Ionicons
            name={status.playing ? 'pause' : 'play'}
            size={18}
            color={mePlayIcon}
            style={status.playing ? undefined : { marginLeft: 2 }}
          />
        )}
      </TouchableOpacity>

      {/* Waveform */}
      <View style={styles.waveformArea}>
        <View style={styles.waveform}>
          {waveHeights.map((h, i) => {
            const barFilled = progressFraction >= (i / NUM_BARS);
            return (
              <View
                key={`bar-${i}`}
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: barFilled ? meActive : meInactive,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Time */}
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: meTimeColor }]}>
            {status.playing ? formatTime(positionMs) : formatTime(displayDurationMs)}
          </Text>
          <Ionicons name="mic" size={10} color={meTimeColor} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 200,
    maxWidth: 260,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  waveformArea: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.25,
    minHeight: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
});
