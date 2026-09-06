import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppImage from '@/components/AppImage';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useCallStore } from '@/store/callStore';
import { acceptCall, rejectCall } from '@/services/calls';
import { startRingtone, stopRingtone } from '@/services/callRingtone';

const C = {
  navy: '#0C1559',
  body: '#0F172A',
  muted: '#64748B',
  danger: '#EF4444',
  success: '#22C55E',
};

export function IncomingCallModal() {
  const phase = useCallStore((s) => s.phase);
  const call = useCallStore((s) => s.call);
  const setAccepted = useCallStore((s) => s.setAccepted);
  const reset = useCallStore((s) => s.reset);
  const [busy, setBusy] = useState(false);

  const visible = phase === 'ringing_incoming' && !!call;

  useEffect(() => {
    if (visible) startRingtone();
    else stopRingtone();
    return () => stopRingtone();
  }, [visible]);

  const handleAccept = async () => {
    if (!call || busy) return;
    setBusy(true);
    try {
      const accepted = await acceptCall(call.callId);
      setAccepted(accepted.startedAt || new Date().toISOString(), { token: accepted.token, appId: accepted.appId });
    } catch {
      reset();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!call || busy) return;
    setBusy(true);
    try {
      await rejectCall(call.callId);
    } catch {
      // best-effort — reset locally regardless
    } finally {
      setBusy(false);
      reset();
    }
  };

  if (!visible || !call) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <GlassSurface style={styles.card}>
          <View style={styles.avatar}>
            {call.otherUserAvatar
              ? <AppImage uri={call.otherUserAvatar} style={styles.avatarImg} contentFit="cover" />
              : <Ionicons name="call" size={28} color={C.navy} />}
          </View>
          <Text style={styles.name}>{call.otherUserName}</Text>
          <Text style={styles.subtitle}>Incoming call…</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={handleReject} disabled={busy}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAccept]} onPress={handleAccept} disabled={busy}>
              <Ionicons name="call" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  name: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 18,
    color: C.body,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: C.muted,
    marginBottom: 28,
  },
  actions: {
    flexDirection: 'row',
    gap: 32,
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnReject: { backgroundColor: C.danger },
  btnAccept: { backgroundColor: C.success },
});
