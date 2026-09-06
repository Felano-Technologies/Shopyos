import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useCallStore } from '@/store/callStore';
import { endCall } from '@/services/calls';
import { joinCall, leaveCall, muteLocalAudio, releaseEngine, setSpeakerphoneEnabled, startLocalRecording, stopLocalRecording } from '@/services/callRecordingService';
import { enqueueRecordingUpload, drainRecordingUploadQueue } from '@/services/recordingUploadQueue';
import { startRingtone, stopRingtone } from '@/services/callRingtone';

const C = {
  navy: '#0C1559',
  body: '#0F172A',
  muted: '#94A3B8',
  danger: '#EF4444',
};

// Derives the same numeric uid the backend uses (deriveNumericUid in
// backend/utils/agora.js) so recordings/analytics referencing uid line up —
// not strictly required for the call to function, but keeps them consistent.
function deriveNumericUid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
}

export function CallScreen({ currentUserId }: { currentUserId: string }) {
  const phase = useCallStore((s) => s.phase);
  const call = useCallStore((s) => s.call);
  const reset = useCallStore((s) => s.reset);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const joinedRef = useRef(false);

  const visible = (phase === 'ringing_outgoing' || phase === 'active') && !!call;

  useEffect(() => {
    setMuted(false);
    setSpeakerOn(false);
  }, [call?.callId]);

  // Ringback while waiting for the other side to accept.
  useEffect(() => {
    if (phase === 'ringing_outgoing') startRingtone();
    else stopRingtone();
    return () => stopRingtone();
  }, [phase]);

  // Join the Agora channel + start local recording once the call is accepted.
  useEffect(() => {
    if (phase !== 'active' || !call?.token || !call?.appId || joinedRef.current) return;
    joinedRef.current = true;

    joinCall(
      { appId: call.appId, token: call.token, channelName: call.channelName, uid: deriveNumericUid(currentUserId) },
      { onError: (err) => console.warn('[Call] Agora error:', err) }
    );
    startLocalRecording(call.callId);

    return () => {
      const path = stopLocalRecording();
      leaveCall();
      releaseEngine();
      if (path && call) {
        enqueueRecordingUpload(call.callId, path).then(() => drainRecordingUploadQueue());
      }
      joinedRef.current = false; // allow the next call to join
    };
  }, [phase, call?.token, call?.appId]);

  // Countdown synced to the server-stamped startedAt, not a local timer that
  // could drift — matches the server-side 30s force-end.
  useEffect(() => {
    if (phase !== 'active' || !call?.startedAt) return;
    const cap = call.durationCapSeconds || 30;
    const startMs = new Date(call.startedAt).getTime();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      setRemainingSeconds(Math.max(0, cap - elapsed));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [phase, call?.startedAt, call?.durationCapSeconds]);

  const handleEnd = async () => {
    if (!call) return;
    try {
      await endCall(call.callId);
    } catch {
      // best-effort — reset locally regardless
    } finally {
      reset();
    }
  };

  if (!visible || !call) return null;

  return (
    <Modal visible transparent={false} animationType="slide">
      <View style={styles.container}>
        <Image source={require('@/assets/images/iconwhite.png')} style={styles.logoWatermark} resizeMode="contain" />
        <View style={styles.center}>
          <View style={styles.avatar}>
            {call.otherUserAvatar
              ? <AppImage uri={call.otherUserAvatar} style={styles.avatarImg} contentFit="cover" />
              : <Ionicons name="person" size={40} color="#FFF" />}
          </View>
          <Text style={styles.name}>{call.otherUserName}</Text>
          <Text style={styles.status}>
            {phase === 'ringing_outgoing' ? 'Calling…' : remainingSeconds != null ? `00:${String(remainingSeconds).padStart(2, '0')}` : 'Connected'}
          </Text>
        </View>

        <GlassSurface style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlBtn, muted && styles.controlBtnActive]}
            onPress={() => {
              const next = !muted;
              setMuted(next);
              muteLocalAudio(next);
            }}
          >
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color={muted ? '#FFF' : C.body} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlBtn, speakerOn && styles.controlBtnActive]}
            onPress={() => {
              const next = !speakerOn;
              setSpeakerOn(next);
              setSpeakerphoneEnabled(next);
            }}
          >
            <Ionicons name={speakerOn ? 'volume-high' : 'volume-medium-outline'} size={22} color={speakerOn ? '#FFF' : C.body} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, styles.endBtn]} onPress={handleEnd}>
            <Ionicons name="call" size={22} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.navy,
    justifyContent: 'space-between',
    paddingTop: 100,
    paddingBottom: 60,
    overflow: 'hidden',
  },
  logoWatermark: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 260,
    height: 260,
    opacity: 0.06,
  },
  center: { alignItems: 'center' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  name: { fontFamily: 'Montserrat-SemiBold', fontSize: 22, color: '#FFF', marginBottom: 8 },
  status: { fontFamily: 'Montserrat-Regular', fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 40,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: { backgroundColor: C.body },
  endBtn: { backgroundColor: C.danger },
});
