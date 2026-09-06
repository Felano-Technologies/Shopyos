// components/calls/CallOverlay.tsx
// Mounted once at the root layout (alongside <Toast /> etc.) so incoming and
// active calls surface globally regardless of which screen is on top.

import React from 'react';
import { useChatStore } from '@/store/chatStore';
import { CallDisclaimerModal } from './CallDisclaimerModal';
import { IncomingCallModal } from './IncomingCallModal';
import { CallScreen } from './CallScreen';

export function CallOverlay() {
  const currentUserId = useChatStore((s) => s.currentUserId);
  if (!currentUserId) return null;

  return (
    <>
      <CallDisclaimerModal />
      <IncomingCallModal />
      <CallScreen currentUserId={currentUserId} />
    </>
  );
}
