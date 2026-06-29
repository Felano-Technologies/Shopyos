import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomInAppToast } from '@/components/InAppToastHost';

interface VoiceRecorderProps {
  onSend: (uri: string, durationMs: number) => void;
  onCancel: () => void;
}

const NUM_BARS = 28;
const MAX_DURATION = 120; // seconds

export default function VoiceRecorder({ onSend, onCancel }: Readonly<VoiceRecorderProps>) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [soundPreview, setSoundPreview] = useState<Audio.Sound | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const barAnims = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(4))
  ).current;
  const meterLevels = useRef<number[]>(new Array(NUM_BARS).fill(4)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const meteringRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);

  // Slide-in animation on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 9,
    }).start();
  }, [slideAnim]);

  // Pulsing record dot
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  // Cleanup audio resources when they change or on unmount
  useEffect(() => {
    return () => {
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
      if (soundPreview) soundPreview.unloadAsync().catch(() => {});
    };
  }, [recording, soundPreview]);

  // Start recording
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        CustomInAppToast.show({
          type: 'error',
          title: 'Permission Denied',
          message: 'Microphone permissions are required to record voice notes.',
        });
        onCancel();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Use HIGH_QUALITY preset (proven to work in Expo Go) with mono override
      const preset = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const { recording: newRecording } = await Audio.Recording.createAsync({
        ...preset,
        isMeteringEnabled: true,
        android: {
          ...preset.android,
          numberOfChannels: 1,
          bitRate: 96000,
        },
        ios: {
          ...preset.ios,
          numberOfChannels: 1,
          bitRate: 96000,
        },
      });

      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);
      durationRef.current = 0;
      if (__DEV__) console.log('[VoiceRecorder] Recording started successfully');

      // Timer
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);

        if (durationRef.current === 110) {
          Vibration.vibrate([0, 100, 50, 100]);
        }

        if (durationRef.current >= MAX_DURATION) {
          stopRecordingAndPreview();
          CustomInAppToast.show({
            type: 'info',
            title: 'Max Limit Reached',
            message: 'Voice messages are capped at 2 minutes.',
          });
        }
      }, 1000);

      // Metering — reads dB levels and animates bars
      meteringRef.current = setInterval(async () => {
        try {
          const status = await newRecording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // metering is in dB, typically -160 to 0
            const db = status.metering;
            const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
            const barHeight = 4 + normalized * 28;

            // Shift levels left and add new reading at the end
            for (let i = 0; i < NUM_BARS - 1; i++) {
              meterLevels[i] = meterLevels[i + 1];
            }
            meterLevels[NUM_BARS - 1] = barHeight;

            // Animate each bar
            for (let i = 0; i < NUM_BARS; i++) {
              Animated.timing(barAnims[i], {
                toValue: meterLevels[i],
                duration: 80,
                useNativeDriver: false,
              }).start();
            }
          }
        } catch (e) {
          if (__DEV__) console.error('Failed to read meter level:', e);
        }
    } catch (err) {
      if (__DEV__) console.error('Failed to start recording', err);
      CustomInAppToast.show({
        type: 'error',
        title: 'Error',
        message: 'Could not initialize microphone.',
      });
      onCancel();
    }
  };

  // Stop recording
  const stopRecordingAndPreview = async () => {
    if (!recording) return;

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (meteringRef.current) { clearInterval(meteringRef.current); meteringRef.current = null; }

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (__DEV__) console.log('[VoiceRecorder] Stopped. URI:', uri);
      setIsRecording(false);
      setRecording(null);
      if (uri) {
        setRecordedUri(uri);
        setPlaybackDuration(durationRef.current * 1000);
      } else {
        if (__DEV__) console.warn('[VoiceRecorder] No URI returned — recording may have failed');
        CustomInAppToast.show({ type: 'error', title: 'Recording Failed', message: 'No audio was captured. Please try again.' });
        onCancel();
      }
    } catch (err) {
      if (__DEV__) console.error('Failed to stop recording', err);
    }
  };

  // Discard
  const discardRecording = async () => {
    if (soundPreview) {
      await soundPreview.unloadAsync();
      setSoundPreview(null);
    }
    setIsPlayingPreview(false);
    setRecordedUri(null);
    setDuration(0);
    durationRef.current = 0;
    // Reset bars
    for (let i = 0; i < NUM_BARS; i++) {
      barAnims[i].setValue(4);
      meterLevels[i] = 4;
    }
    onCancel();
  };

  // Toggle preview playback
  const togglePlayPreview = async () => {
    if (!recordedUri) return;

    if (soundPreview) {
      if (isPlayingPreview) {
        await soundPreview.pauseAsync();
        setIsPlayingPreview(false);
      } else {
        await soundPreview.playAsync();
        setIsPlayingPreview(true);
      }
    } else {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true }
      );
      setSoundPreview(sound);
      setIsPlayingPreview(true);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis || 0);
          if (status.durationMillis) setPlaybackDuration(status.durationMillis);
          if (status.didJustFinish) {
            setIsPlayingPreview(false);
            setPlaybackPosition(0);
            sound.setPositionAsync(0).catch(() => {});
          }
        }
      });
    }
  };

  // Send
  const handleSend = async () => {
    if (!recordedUri) return;
    try {
      if (soundPreview) {
        await soundPreview.unloadAsync();
        setSoundPreview(null);
      }
      onSend(recordedUri, duration * 1000);
    } catch (err) {
      if (__DEV__) console.error('Send voice note failed', err);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const previewProgress = playbackDuration > 0 ? playbackPosition / playbackDuration : 0;

  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (meteringRef.current) clearInterval(meteringRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = isRecording ? (
    /* ---- RECORDING MODE ---- */
    <View style={styles.recordingContainer}>
      {/* Top row: cancel + timer */}
      <View style={styles.recordTopRow}>
        <TouchableOpacity onPress={discardRecording} style={styles.cancelBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color="#EF4444" />
        </TouchableOpacity>

        <View style={styles.timerPill}>
          <Animated.View style={[styles.recordDot, { opacity: pulseAnim }]} />
          <Text style={[styles.timerText, duration >= 110 && styles.timerWarning]}>
            {formatTime(duration)}
          </Text>
          <Text style={styles.timerMax}> / 2:00</Text>
        </View>

        <TouchableOpacity onPress={stopRecordingAndPreview} style={styles.stopBtn}>
          <View style={styles.stopSquare} />
        </TouchableOpacity>
      </View>

      {/* Waveform bars */}
      <View style={styles.waveformContainer}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={`rec-bar-${i}`}
            style={[
              styles.waveBar,
              {
                height: anim,
                backgroundColor: i > NUM_BARS - 4 ? '#84cc16' : 'rgba(132, 204, 22, 0.6)',
              },
            ]}
          />
        ))}
      </View>

      {/* Hint */}
      <Text style={styles.hintText}>{"Tap stop when you're done"}</Text>
    </View>
  ) : recordedUri ? (
    /* ---- PREVIEW MODE ---- */
    <View style={styles.previewContainer}>
      {/* Waveform playback visualization */}
      <View style={styles.previewWaveRow}>
        <TouchableOpacity onPress={togglePlayPreview} style={styles.playBtn}>
          <Ionicons name={isPlayingPreview ? 'pause' : 'play'} size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.previewWaveform}>
          {Array.from({ length: NUM_BARS }).map((_, i) => {
            const barFilled = previewProgress >= (i / NUM_BARS);
            const h = Math.max(4, meterLevels[i] || (6 + Math.sin(i * 0.7) * 10));
            return (
              <View
                key={`prev-bar-${i}`}
                style={[
                  styles.previewBar,
                  {
                    height: h,
                    backgroundColor: barFilled ? '#84cc16' : 'rgba(255,255,255,0.25)',
                  },
                ]}
              />
            );
          })}
        </View>

        <Text style={styles.previewTime}>
          {isPlayingPreview ? formatTime(Math.floor(playbackPosition / 1000)) : formatTime(duration)}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.previewActions}>
        <TouchableOpacity onPress={discardRecording} style={styles.discardBtn}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSend} style={styles.sendVoiceBtn}>
          <LinearGradient
            colors={['#84cc16', '#65a30d']}
            style={styles.sendGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="send" size={16} color="#fff" style={{ marginLeft: 2 }} />
            <Text style={styles.sendText}>Send</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C1559',
    borderRadius: 24,
    marginBottom: 4,
    overflow: 'hidden',
  },

  // ---- Recording mode ----
  recordingContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  timerText: {
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#fff',
  },
  timerWarning: {
    color: '#EF4444',
  },
  timerMax: {
    fontSize: 12,
    fontFamily: 'Montserrat-Medium',
    color: 'rgba(255,255,255,0.35)',
  },
  stopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 3,
  },
  hintText: {
    fontSize: 11,
    fontFamily: 'Montserrat-Medium',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },

  // ---- Preview mode ----
  previewContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  previewWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#84cc16',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    elevation: 3,
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  previewWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
  },
  previewBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 3,
  },
  previewTime: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 12,
    minWidth: 36,
  },

  // Actions
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  discardText: {
    fontSize: 13,
    fontFamily: 'Montserrat-SemiBold',
    color: '#EF4444',
  },
  sendVoiceBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  sendGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  sendText: {
    fontSize: 13,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
  },
});
