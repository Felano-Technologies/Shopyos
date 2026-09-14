// components/calls/CallEndedNotice.tsx
// Closes a gap where the call screen just silently unmounts once `phase`
// becomes 'ended' (CallScreen/IncomingCallModal only render for their own
// tracked phases) — this shows a brief toast so the user actually learns
// their call was missed/rejected/ended, then resets the store. Only ever
// meaningfully fires for whichever side did NOT tap "hang up" themselves —
// a self-initiated hangup calls reset() directly and never passes through
// the 'ended' phase.

import { useEffect } from 'react';
import { useCallStore } from '@/store/callStore';
import { CustomInAppToast } from '@/services/api';

function describeEnd(reason: string | null, otherUserName?: string): { title: string; message: string } {
  const name = otherUserName || 'The other person';
  switch (reason) {
    case 'rejected':
      return { title: 'Call declined', message: `${name} declined your call.` };
    case 'missed':
      return { title: 'Missed call', message: `${name} didn't answer.` };
    case 'timeout_30s':
      return { title: 'Call ended', message: 'The call reached its time limit.' };
    default:
      return { title: 'Call ended', message: `Your call with ${name} has ended.` };
  }
}

export function CallEndedNotice() {
  const phase = useCallStore((s) => s.phase);
  const endReason = useCallStore((s) => s.endReason);
  const call = useCallStore((s) => s.call);
  const reset = useCallStore((s) => s.reset);

  useEffect(() => {
    if (phase !== 'ended') return;
    const { title, message } = describeEnd(endReason, call?.otherUserName);
    CustomInAppToast.show({ type: 'info', title, message });
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return null;
}
