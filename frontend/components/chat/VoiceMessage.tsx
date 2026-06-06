import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface VoiceMessageProps {
  url: string;
  durationMs?: number;
  isMe: boolean;
}

const NUM_BARS = 24;

export default function VoiceMessage({ url, durationMs = 0, isMe }: VoiceMessageProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(durationMs);
  const [loading, setLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  // Generate a stable pseudo-random waveform shape from the URL
  const waveHeights = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < url.length; i++) {
      seed = ((seed << 5) - seed + url.charCodeAt(i)) | 0;
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
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      if (status.durationMillis) setDuration(status.durationMillis);
      // Don't derive isPlaying from status — it flickers false during buffering
      // and causes the timer to snap back to showing the static duration
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        if (soundRef.current) soundRef.current.setPositionAsync(0).catch(() => {});
      }
    }
  };

  const handlePlayPause = async () => {
    setLoading(true);
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = newSound;
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Failed to play sound', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressFraction = duration > 0 ? position / duration : 0;

  const meActive = isMe ? '#fff' : '#84cc16';
  const meInactive = isMe ? 'rgba(255,255,255,0.25)' : 'rgba(12,21,89,0.15)';
  const mePlayBtnBg = isMe ? 'rgba(255,255,255,0.2)' : '#84cc16';
  const mePlayIcon = isMe ? '#fff' : '#fff';
  const meTimeColor = isMe ? 'rgba(255,255,255,0.5)' : '#64748B';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {/* Play button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={loading}
        style={[styles.playBtn, { backgroundColor: mePlayBtnBg }]}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={mePlayIcon} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={mePlayIcon}
            style={!isPlaying ? { marginLeft: 2 } : undefined}
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
                key={i}
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
            {isPlaying ? formatTime(position) : formatTime(duration)}
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
