// hooks/useStartCall.ts
// The single entry point every screen should use instead of
// Linking.openURL(`tel:${phone}`) — keeps the call in-app, logged, and
// recorded. Shows the "30s, recorded for audit" disclaimer first (see
// CallDisclaimerModal); the actual call is only placed once the user taps
// Proceed there. See callController.js's canUsersCall for who may call whom.

import { useCallback } from 'react';
import { useCallStore } from '@/store/callStore';
import { CustomInAppToast } from '@/services/api';

export function useStartCall() {
  const promptCall = useCallStore((s) => s.promptCall);
  const phase = useCallStore((s) => s.phase);

  return useCallback(
    (receiverId: string, receiverName: string, orderId?: string) => {
      if (phase !== 'idle') {
        CustomInAppToast.show({ type: 'info', title: 'Call in progress', message: 'You are already on a call.' });
        return;
      }
      promptCall({ receiverId, receiverName, orderId });
    },
    [phase, promptCall]
  );
}
