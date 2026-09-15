// components/calls/CallEndedNotice.tsx
// Closes a gap where the call screen just silently unmounts once `phase`
// becomes 'ended' (CallScreen/IncomingCallModal only render for their own
// tracked phases) — this shows an actual modal explaining why the call
// ended, then resets the store on dismiss. Only ever meaningfully fires for
// whichever side did NOT tap "hang up" themselves — a self-initiated hangup
// calls reset() directly and never passes through the 'ended' phase.
//
// A toast was tried here first, but it rendered at the same moment
// CallScreen's own full-screen Modal was closing, which made it easy to
// miss or have it appear stuck behind that Modal during the transition.
// Rendered after CallScreen/IncomingCallModal in CallOverlay's tree, so it
// mounts on top rather than racing z-order with them.

import { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallStore } from '@/store/callStore';
import { GlassSurface } from '@/components/ui/GlassSurface';

const C = {
  navy: '#0C1559',
  body: '#0F172A',
  muted: '#64748B',
};

const AUTO_DISMISS_MS = 4000;

function describeEnd(reason: string | null, otherUserName?: string): { title: string; message: string; icon: keyof typeof Ionicons.glyphMap } {
  const name = otherUserName || 'The other person';
  switch (reason) {
    case 'rejected':
      return { title: 'Call declined', message: `${name} declined your call.`, icon: 'close-circle' };
    case 'missed':
      return { title: 'Missed call', message: `${name} didn't answer.`, icon: 'call-outline' };
    case 'timeout_30s':
      return { title: 'Call ended', message: 'The call reached its 30 second time limit.', icon: 'time-outline' };
    case 'caller_hangup':
    case 'receiver_hangup':
      return { title: 'Call ended', message: `Your call with ${name} has ended.`, icon: 'call' };
    default:
      return { title: 'Call ended', message: `Your call with ${name} has ended.`, icon: 'call' };
  }
}

export function CallEndedNotice() {
  const phase = useCallStore((s) => s.phase);
  const endReason = useCallStore((s) => s.endReason);
  const call = useCallStore((s) => s.call);
  const reset = useCallStore((s) => s.reset);

  const visible = phase === 'ended';

  // Auto-dismiss as a safety net — the user closing it manually is the
  // primary path, but this guarantees the store can never get stuck on
  // 'ended' (which would otherwise block placing/receiving the next call,
  // exactly like the missing receiver-side call:ended emit used to).
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(reset, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, reset]);

  if (!visible) return null;

  const { title, message, icon } = describeEnd(endReason, call?.otherUserName);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={reset}>
      <View style={styles.overlay}>
        <GlassSurface style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={26} color={C.navy} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={reset} activeOpacity={0.85}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 17,
    color: C.body,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 22,
  },
  button: {
    backgroundColor: C.navy,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
  },
  buttonText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
