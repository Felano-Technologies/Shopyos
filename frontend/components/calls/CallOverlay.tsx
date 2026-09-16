// components/calls/CallOverlay.tsx
// Mounted once at the root layout (alongside <Toast /> etc.) so incoming and
// active calls surface globally regardless of which screen is on top.

import React, { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useCallStore } from '@/store/callStore';
import { CustomInAppToast } from '@/services/api';
import { CallDisclaimerModal } from './CallDisclaimerModal';
import { IncomingCallModal } from './IncomingCallModal';
import { CallScreen } from './CallScreen';
import { CallEndedNotice } from './CallEndedNotice';

// Safety net: useStartCall blocks placing/receiving a new call whenever
// `phase !== 'idle'`, on the assumption a non-idle phase always means a real
// call is genuinely in progress. If anything in that chain ever hangs
// without reaching 'active' or resetting back to 'idle' — a modal that
// silently fails to register a tap, a network call that never resolves,
// some future bug — the user is stuck seeing "already on a call" forever,
// with no recovery except restarting the app. 'active' is deliberately
// excluded: a real accepted call legitimately stays there for its full
// duration with its own server-side timers. Everything else (confirming,
// ringing_outgoing, ringing_incoming) should always resolve within seconds;
// 60s is generous enough to never fire during normal use.
function useCallPhaseWatchdog() {
  const phase = useCallStore((s) => s.phase);
  const reset = useCallStore((s) => s.reset);

  useEffect(() => {
    if (phase === 'idle' || phase === 'active') return;
    const timer = setTimeout(() => {
      console.warn(`[Call] phase stuck at "${phase}" for 60s — auto-resetting`);
      reset();
      CustomInAppToast.show({ type: 'info', title: 'Call reset', message: 'Something went wrong with that call — please try again.' });
    }, 60000);
    return () => clearTimeout(timer);
  }, [phase, reset]);
}

export function CallOverlay() {
  const currentUserId = useChatStore((s) => s.currentUserId);
  useCallPhaseWatchdog();
  if (!currentUserId) return null;

  return (
    <>
      <CallDisclaimerModal />
      <IncomingCallModal />
      <CallScreen currentUserId={currentUserId} />
      <CallEndedNotice />
    </>
  );
}
