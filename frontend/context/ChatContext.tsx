import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getConversations,
  sendMessage as apiSendMessage,
  deleteConversation as apiDeleteConversation,
  storage,
  secureStorage
} from '../services/api';
import { socketService } from '../services/socket';
import { usePathname, useGlobalSearchParams, useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { CallOverlay } from '../components/CallOverlay';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

export type CallState = 'idle' | 'incoming' | 'outgoing' | 'connected' | 'ended';

interface CallData {
  conversationId: string;
  name: string;
  avatar: string;
}

export type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
};

export type Conversation = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages: Message[];
  otherParticipant?: any;
};

type ChatContextType = {
  buyerConversations: Conversation[];
  sellerConversations: Conversation[];
  sendMessage: (id: string, text: string, type: 'buyer' | 'seller') => void;
  markAsRead: (id: string, type: 'buyer' | 'seller') => void;
  deleteConversation: (id: string, type: 'buyer' | 'seller') => Promise<boolean>;
  refresh: () => void;
  currentUserId: string | null;
  callState: CallState;
  callData: CallData | null;
  startCall: (id: string, name: string, avatar: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  isMuted: boolean;
  isSpeakerOn: boolean;
  toggleMute: () => void;
  toggleSpeaker: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [buyerConversations, setBuyerChats] = useState<Conversation[]>([]);
  const [sellerConversations, setSellerChats] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [callState, setCallStatus] = useState<CallState>('idle');
  const [callData, setCallData] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const peerConnection = React.useRef<any>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const router = useRouter();
  const pathnameRef = React.useRef(pathname);
  const conversationIdRef = React.useRef(searchParams?.conversationId);

  useEffect(() => {
    pathnameRef.current = pathname;
    conversationIdRef.current = searchParams?.conversationId;
  }, [pathname, searchParams?.conversationId]);

  const playCallRingtone = useCallback(async () => {
    try {
      await stopRingtone();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/ringtone.wav'),
        { isLooping: true, volume: 0.85, shouldPlay: true }
      );
      soundRef.current = sound;
    } catch (e) {
      console.warn('Could not play call ringtone:', e);
    }
  });

  const playNotificationChime = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/notification.wav'),
        { isLooping: false, volume: 0.25, shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => null);
        }
      });
    } catch (e) {
      console.warn('Could not play notification chime:', e);
    }
  };

  const stopRingtone = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
        soundRef.current = null;
      }
    } catch (e) {
      console.warn('Could not stop ringtone:', e);
    }
  };

  const fetchChats = async () => {
    try {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (!token) return;

      let activeUserId = await storage.getItem('userId');
      if (!activeUserId) {
        try {
          const { getUserData } = require('../services/api');
          const me = await getUserData();
          if (me?.id) {
            activeUserId = me.id;
            await storage.setItem('userId', activeUserId!);
          }
        } catch (e) {}
      }
      if (activeUserId) setCurrentUserId(activeUserId);

      const response = await getConversations();
      if (response?.conversations) {
        const formatted: Conversation[] = response.conversations.map((c: any) => {
          const p = c.otherParticipant;
          let name = 'Unknown User';
          let avatar = 'https://via.placeholder.com/150';
          if (p) {
            if (p.store) {
              name = p.store.store_name || name;
              avatar = p.store.logo_url || avatar;
            } else {
              const profile = Array.isArray(p.user_profiles) ? p.user_profiles[0] : p.user_profiles;
              if (profile) {
                name = profile.full_name || name;
                avatar = profile.avatar_url || avatar;
              }
            }
          }
          const lastMsgSenderId = c.lastMessage?.sender_id;
          const isMe = activeUserId && lastMsgSenderId === activeUserId;
          const time = c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          return {
            id: c.id,
            name,
            avatar,
            lastMessage: c.lastMessage?.content || 'No messages yet',
            time,
            unread: c.unreadCount || 0,
            online: false,
            messages: c.lastMessage ? [{ id: c.lastMessage.id, text: c.lastMessage.content, sender: isMe ? 'me' : 'them', time }] : [],
            otherParticipant: p,
          };
        });

        setBuyerChats(formatted.filter(c => c.otherParticipant?.store?.id));
        setSellerChats(formatted.filter(c => !c.otherParticipant?.store?.id));
      }
    } catch (error: any) {
      if (error.response?.status !== 401) console.error('Failed to load chats', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const handleNewMessage = (data: any) => {
      const { message, conversationId } = data;
      const isMe = currentUserId && message.sender_id === currentUserId;

      const updateList = (prev: Conversation[]) => {
        if (!prev.some(c => c.id === conversationId)) {
          fetchChats();
          return prev;
        }

        const isViewing =
          pathnameRef.current === '/chat/conversation' &&
          conversationIdRef.current === conversationId;

        return prev
          .map(c =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: message.content,
                  time: new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  }),
                  unread: isMe || isViewing ? c.unread : c.unread + 1
                }
              : c
          )
          .sort((a, b) => (a.id === conversationId ? -1 : b.id === conversationId ? 1 : 0));
      };

      setBuyerChats(updateList);
      setSellerChats(updateList);
    };

    const handleIncomingCall = async (data: any) => {
      if (!isMounted) return;
      setCallData({ conversationId: data.conversationId, name: data.callerName, avatar: data.callerAvatar });
      setCallStatus('incoming');
      await playCallRingtone();
    };

    const handleAcceptedCall = async (data: any) => {
      if (!isMounted) return;
      await stopRingtone();
      setCallStatus('connected');
      const pc = await setupPeerConnection(data.conversationId);
      if (pc) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendOffer(data.conversationId, offer);
      }
    };

    const handleRejectedCall = async () => {
      if (!isMounted) return;
      await stopRingtone();
      setCallStatus('ended');
      setTimeout(() => setCallStatus('idle'), 2000);
    };

    const handleEndedCall = async () => {
      if (!isMounted) return;
      await stopRingtone();
      setCallStatus('ended');
      setTimeout(() => setCallStatus('idle'), 2000);
    };

    const initSocket = async () => {
      try {
        const token =
          (await secureStorage.getItem('userToken')) ||
          (await secureStorage.getItem('businessToken'));
        if (!token) return;

        await socketService.connect();
        await socketService.onNewMessage(handleNewMessage);
        await socketService.onCallEvent('call:incoming', handleIncomingCall);
        await socketService.onCallEvent('call:accepted', handleAcceptedCall);
        await socketService.onCallEvent('call:rejected', handleRejectedCall);
        await socketService.onCallEvent('call:ended', handleEndedCall);
      } catch (err) {}
    };

    initSocket();

    return () => {
      isMounted = false;
      socketService.offNewMessage(handleNewMessage);
      socketService.offCallEvent('call:incoming', handleIncomingCall);
      socketService.offCallEvent('call:accepted', handleAcceptedCall);
      socketService.offCallEvent('call:rejected', handleRejectedCall);
      socketService.offCallEvent('call:ended', handleEndedCall);
    };
  }, [currentUserId, playCallRingtone]);

  const setupPeerConnection = async (conversationId: string) => {
    if (isExpoGo) { CustomInAppToast.show({ type: 'info', title: 'Not Supported', message: 'Calls require standalone app.' }); return; }
    const { RTCPeerConnection, mediaDevices } = require('react-native-webrtc');
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = (e: any) => e.candidate && socketService.sendIceCandidate(conversationId, e.candidate);
    pc.ontrack = (e: any) => e.streams?.[0] && setRemoteStream(e.streams[0]);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      pc.addStream(stream);
    } catch {}
    peerConnection.current = pc;
    return pc;
  };

  useEffect(() => { fetchChats(); }, []);

  const cleanupCall = () => {
    if (localStream) { localStream.getTracks().forEach((t: any) => t.stop()); setLocalStream(null); }
    if (peerConnection.current) { peerConnection.current.close(); peerConnection.current = null; }
    setRemoteStream(null); setCallData(null); setIsMuted(false); setIsSpeakerOn(false);
  };

  const toggleMute = () => { if (localStream) { localStream.getAudioTracks().forEach((t: any) => t.enabled = !t.enabled); setIsMuted(!isMuted); } };
  const toggleSpeaker = async () => { const next = !isSpeakerOn; try { await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: !next }); setIsSpeakerOn(next); } catch {} };

  const startCall = async (id: string, name: string, avatar: string) => { setCallData({ conversationId: id, name, avatar }); setCallStatus('outgoing'); await playCallRingtone(); await socketService.initiateCall(id, name, avatar); };
  const acceptCall = async () => { await stopRingtone(); if (callData) { setCallStatus('connected'); await setupPeerConnection(callData.conversationId); await socketService.acceptCall(callData.conversationId); } };
  const rejectCall = async () => { await stopRingtone(); if (callData) { setCallStatus('idle'); await socketService.rejectCall(callData.conversationId); cleanupCall(); } };
  const endCall = async () => { await stopRingtone(); if (callData) { setCallStatus('ended'); await socketService.endCall(callData.conversationId); cleanupCall(); setTimeout(() => setCallStatus('idle'), 2000); } };

  const sendMessage = async (id: string, text: string, type: 'buyer' | 'seller') => { if (socketService.isConnected()) await socketService.sendMessage(id, text); else await apiSendMessage(id, text); fetchChats(); };
  const markAsRead = async (id: string) => { try { await socketService.markConversationRead(id); } catch {} fetchChats(); };
  const deleteConversation = async (id: string) => { try { await apiDeleteConversation(id); return true; } catch { return false; } finally { fetchChats(); } };

  return (
    <ChatContext.Provider value={{ buyerConversations, sellerConversations, sendMessage, markAsRead, deleteConversation, refresh: fetchChats, currentUserId, callState, callData, startCall, acceptCall, rejectCall, endCall, isMuted, isSpeakerOn, toggleMute, toggleSpeaker }}>
      {children}
      <CallOverlay isVisible={callState !== 'idle'} status={callState === 'outgoing' ? 'outgoing' : callState === 'incoming' ? 'incoming' : callState === 'connected' ? 'connected' : 'ended'} name={callData?.name || 'Unknown'} avatar={callData?.avatar || ''} onAccept={acceptCall} onReject={rejectCall} onEnd={endCall} isMuted={isMuted} isSpeakerOn={isSpeakerOn} onToggleMute={toggleMute} onToggleSpeaker={toggleSpeaker} />
    </ChatContext.Provider>
  );
};

export const useChat = () => { const c = useContext(ChatContext); if (!c) throw new Error('useChat must be used within a ChatProvider'); return c; };
