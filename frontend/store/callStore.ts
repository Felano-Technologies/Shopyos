import { create } from 'zustand';

export type CallPhase =
  | 'idle'
  | 'confirming'       // showing the "30s, recorded" disclaimer before placing the call
  | 'ringing_outgoing' // I initiated, waiting for the other side to accept
  | 'ringing_incoming' // Someone is calling me
  | 'active'           // Accepted, Agora channel joined
  | 'ended';

export type PendingCallTarget = { receiverId: string; receiverName: string; orderId?: string };

type ActiveCall = {
  callId: string;
  channelName: string;
  token: string;
  appId: string;
  otherUserId: string;
  otherUserName: string;
  orderId: string | null;
  startedAt: string | null;      // server-stamped once accepted — authoritative for the 30s countdown
  durationCapSeconds: number;
  isCaller: boolean;
};

type CallStore = {
  phase: CallPhase;
  call: ActiveCall | null;
  endReason: string | null;
  pendingTarget: PendingCallTarget | null;

  promptCall: (target: PendingCallTarget) => void;
  cancelPrompt: () => void;
  setOutgoing: (call: Omit<ActiveCall, 'startedAt' | 'isCaller'>) => void;
  setIncoming: (call: Omit<ActiveCall, 'startedAt' | 'isCaller' | 'durationCapSeconds'> & { durationCapSeconds?: number }) => void;
  setAccepted: (startedAt: string, tokenAndAppId?: { token: string; appId: string }) => void;
  setEnded: (reason?: string) => void;
  reset: () => void;
};

export const useCallStore = create<CallStore>((set, get) => ({
  phase: 'idle',
  call: null,
  endReason: null,
  pendingTarget: null,

  promptCall: (target) => set({ phase: 'confirming', pendingTarget: target }),
  cancelPrompt: () => set({ phase: 'idle', pendingTarget: null }),

  setOutgoing: (call) => set({
    phase: 'ringing_outgoing',
    call: { ...call, startedAt: null, isCaller: true },
    endReason: null,
    pendingTarget: null,
  }),

  setIncoming: (call) => set({
    phase: 'ringing_incoming',
    call: { ...call, startedAt: null, isCaller: false, durationCapSeconds: call.durationCapSeconds ?? 30 },
    endReason: null,
  }),

  setAccepted: (startedAt, tokenAndAppId) => {
    const current = get().call;
    if (!current) return;
    set({
      phase: 'active',
      call: { ...current, startedAt, ...(tokenAndAppId || {}) },
    });
  },

  setEnded: (reason) => set({ phase: 'ended', endReason: reason || null }),

  reset: () => set({ phase: 'idle', call: null, endReason: null }),
}));
