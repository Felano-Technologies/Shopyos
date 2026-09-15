import React, { useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useCallStore } from '@/store/callStore';
import { initiateCall } from '@/services/calls';
import { CustomInAppToast } from '@/services/api';
import { requestCallMicrophonePermissionWithDisclosure } from '@/src/utils/permissions';

export function CallDisclaimerModal() {
  const phase = useCallStore((s) => s.phase);
  const pendingTarget = useCallStore((s) => s.pendingTarget);
  const cancelPrompt = useCallStore((s) => s.cancelPrompt);
  const setOutgoing = useCallStore((s) => s.setOutgoing);
  const [placing, setPlacing] = useState(false);

  const visible = phase === 'confirming' && !!pendingTarget;

  const handleProceed = async () => {
    if (!pendingTarget || placing) return;
    setPlacing(true);
    try {
      // Requested here, before CallScreen's own full-screen Modal ever
      // mounts (it becomes visible the instant setOutgoing() below fires) —
      // asking for it later, inside CallScreen's join effect, means showing
      // this disclosure's own Modal ON TOP of an already-visible Modal,
      // which is exactly what caused the OS permission prompt to appear
      // without the in-app "Continue" step ever properly registering.
      const permission = await requestCallMicrophonePermissionWithDisclosure();
      if (permission.status !== 'granted') {
        CustomInAppToast.show({ type: 'error', title: 'Microphone required', message: 'Microphone access is required to make calls.' });
        cancelPrompt();
        return;
      }

      const call = await initiateCall(pendingTarget.receiverId, pendingTarget.orderId);
      setOutgoing({
        callId: call.id,
        channelName: call.channelName,
        token: call.token,
        appId: call.appId,
        otherUserId: pendingTarget.receiverId,
        otherUserName: pendingTarget.receiverName,
        otherUserAvatar: call.receiverAvatar || null,
        orderId: pendingTarget.orderId || null,
        durationCapSeconds: call.durationCapSeconds,
      });
    } catch (error: any) {
      CustomInAppToast.show({ type: 'error', title: 'Call failed', message: error.message || 'Could not start the call.' });
      cancelPrompt();
    } finally {
      setPlacing(false);
    }
  };

  if (!visible) return null;

  return (
    <ConfirmModal
      visible={visible}
      onClose={cancelPrompt}
      icon="📞"
      title={`Call ${pendingTarget?.receiverName || ''}`}
      message="Calls are limited to 30 seconds and are recorded for audit and dispute-resolution purposes. For anything that isn't urgent, sending a text message is usually faster."
      actions={[
        { label: 'Cancel', onPress: cancelPrompt, variant: 'cancel' },
        { label: 'Proceed', onPress: handleProceed, variant: 'primary', loading: placing },
      ]}
    />
  );
}
