// hooks/useCallListener.ts
// Global socket listener for in-app call signaling — mirrors useSocketSetup's
// pattern. Mounted once at the root layout so an incoming call surfaces
// regardless of which screen the user is currently on.

import { useEffect } from 'react';
import { socketService } from '../services/socket';
import { useCallStore } from '../store/callStore';

export const useCallListener = () => {
  const setIncoming = useCallStore((s) => s.setIncoming);
  const setAccepted = useCallStore((s) => s.setAccepted);
  const setEnded = useCallStore((s) => s.setEnded);
  const reset = useCallStore((s) => s.reset);

  useEffect(() => {
    const handleIncoming = (data: any) => {
      // Ignore a second incoming call while one is already ringing/active —
      // the caller will simply see this call ring out (status: 'missed').
      if (useCallStore.getState().phase !== 'idle') return;
      setIncoming({
        callId: data.callId,
        channelName: data.channelName,
        token: '', // minted on accept, not carried in the incoming push
        appId: '',
        otherUserId: data.callerId,
        otherUserName: data.callerName || 'Unknown caller',
        otherUserAvatar: data.callerAvatar || null,
        orderId: data.orderId || null,
      });
    };

    const handleAccepted = (data: any) => {
      const current = useCallStore.getState().call;
      if (!current || current.callId !== data.callId) return;
      // The caller's own acceptCall-equivalent token was already minted at
      // initiateCall time; started_at arrives from the accept event so both
      // sides agree on the server-authoritative clock.
      setAccepted(data.startedAt || new Date().toISOString());
    };

    const handleRejected = (data: any) => {
      const current = useCallStore.getState().call;
      if (!current || current.callId !== data.callId) return;
      setEnded('rejected');
    };

    const handleMissed = (data: any) => {
      const current = useCallStore.getState().call;
      if (!current || current.callId !== data.callId) return;
      setEnded('missed');
    };

    const handleEnded = (data: any) => {
      const current = useCallStore.getState().call;
      if (!current || current.callId !== data.callId) return;
      setEnded(data.reason || 'ended');
    };

    socketService.on('call:incoming', handleIncoming);
    socketService.on('call:accepted', handleAccepted);
    socketService.on('call:rejected', handleRejected);
    socketService.on('call:missed', handleMissed);
    socketService.on('call:ended', handleEnded);

    return () => {
      socketService.off('call:incoming', handleIncoming);
      socketService.off('call:accepted', handleAccepted);
      socketService.off('call:rejected', handleRejected);
      socketService.off('call:missed', handleMissed);
      socketService.off('call:ended', handleEnded);
    };
  }, [setIncoming, setAccepted, setEnded, reset]);
};
