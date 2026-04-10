import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getConversations,
  sendMessage as apiSendMessage,
  markConversationRead,
  deleteConversation as apiDeleteConversation,
  storage,
  secureStorage
} from '../../services/api';
import { socketService } from '../../services/socket';
import { usePathname, useGlobalSearchParams, useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { CallOverlay } from '../../components/CallOverlay';
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
  // FIX 1: ref to hold the active ringtone sound object
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const router = useRouter();

  // ─── Sound helpers ────────────────────────────────────────────────────────
  //
  // Two sounds with distinct volumes and behaviours:
  //   • playCallRingtone()   – loops at 0.85 vol through the speaker (for ringing).
  //   • playNotificationChime() – plays once at 0.25 vol (soft ping for messages).
  //
  // To use a dedicated ringtone file, place `ringtone.mp3` in assets/sounds/.
  // The code falls back to notification.mp3 so nothing breaks if it is absent.

  /**
   * Play the call ringtone in a loop through the main speaker.
   * Loud enough to be noticed, not as jarring as a full-blast alert.
   */
  const playCallRingtone = async () => {
    try {
      await stopRingtone();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false, // route to main speaker
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/ringtone.wav'),
        { isLooping: true, volume: 0.85, shouldPlay: true }
      );
      soundRef.current = sound;
    } catch (e) {
      console.warn('Could not play call ringtone:', e);
    }
  };

  /**
   * Play a single soft notification chime for incoming messages.
   * Plays once at a low volume (0.25) and self-cleans up.
   */
  const playNotificationChime = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.wav'),
        { isLooping: false, volume: 0.25, shouldPlay: true }
      );
      // Auto-unload once it finishes to avoid memory leaks
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => null);
        }
      });
    } catch (e) {
      console.warn('Could not play notification chime:', e);
    }
  };

  /**
   * Stop and unload the current looping ringtone. Safe to call when silent.
   */
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

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchChats = async () => {
    try {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (!token) return;

      let activeUserId = await storage.getItem('userId');
      if (activeUserId) {
        setCurrentUserId(activeUserId);
      } else {
        try {
          const { api } = require('../../services/api');
          const meResponse = await api.get('/auth/me');
          if (meResponse.data?.id) {
            activeUserId = meResponse.data.id;
            await storage.setItem('userId', activeUserId!);
            setCurrentUserId(activeUserId);
          }
        } catch (e) {
          console.warn('Failed to fetch userId for chat:', e);
        }
      }

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
              const profile = Array.isArray(p.user_profiles)
                ? p.user_profiles[0]
                : p.user_profiles;
              if (profile) {
                name = profile.full_name || name;
                avatar = profile.avatar_url || avatar;
              }
            }
          }

          const lastMsgSenderId = c.lastMessage?.sender_id;
          const isMe = activeUserId && lastMsgSenderId === activeUserId;
          const time = c.updatedAt
            ? new Date(c.updatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
            : '';

          const messages = c.lastMessage
            ? [
              {
                id: c.lastMessage.id,
                text: c.lastMessage.content,
                sender: isMe ? ('me' as const) : ('them' as const),
                time,
              },
            ]
            : [];

          return {
            id: c.id,
            name,
            avatar,
            lastMessage: c.lastMessage?.content || 'No messages yet',
            time,
            unread: c.unreadCount || 0,
            online: false,
            messages,
            otherParticipant: p,
          };
        });

        const buyers = formatted.filter(c => {
          const s = c.otherParticipant?.store;
          return s && (s.id || s._id || s.store_name);
        });
        
        const sellers = formatted.filter(c => {
          const s = c.otherParticipant?.store;
          return !s || !(s.id || s._id || s.store_name);
        });

        setBuyerChats(buyers);
        setSellerChats(sellers);
      }
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error('Failed to load chats', error);
      }
    }
  };

  // ─── Socket: inbox-level updates only ────────────────────────────────────────
  // FIX: ChatContext ONLY updates the conversation list's last message + unread count.
  // It does NOT append to the `messages` array. The ConversationScreen handles
  // individual message insertion — this prevents duplicate messages.
  useEffect(() => {
    const initSocket = async () => {
      try {
        const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
        if (!token) return;

        await socketService.connect();

        const handleInboxUpdate = (data: {
          message: any;
          conversationId: string;
        }) => {
          const { message, conversationId } = data;
          const isMe = currentUserId && message.sender_id === currentUserId;

          // Update the conversation list: bump lastMessage, time, unread count
          const updateList = (prev: Conversation[]) => {
            const exists = prev.some(c => c.id === conversationId);

            // If the conversation is new and not in the list, fetch all to get participant details
            if (!exists) {
              fetchChats();
              return prev;
            }

            // Otherwise, update existing chat and move it to the top
            const updatedChats = prev.map((conv) => {
              if (conv.id !== conversationId) return conv;

              const isViewingThisChat =
                pathname === '/chat/conversation' &&
                searchParams?.conversationId === conversationId;

              // Show toast for incoming messages not currently on screen
              if (!isMe && !isViewingThisChat) {
                // Soft chime for message notifications (quiet, plays once)
                playNotificationChime().catch(() => null);
                CustomInAppToast.show({
                  type: 'info',
                  title: conv.name,
                  message: message.content,
                  onPress: () => {
                    router.push({
                      pathname: '/chat/conversation',
                      params: {
                        conversationId: conv.id,
                        name: conv.name,
                        avatar: conv.avatar,
                        chatType: conv.otherParticipant?.store ? 'buyer' : 'seller',
                      },
                    });
                    ;
                  },
                });
              }

              return {
                ...conv,
                lastMessage: message.content,
                time: new Date(message.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                messages: [
                  ...conv.messages,
                  {
                    id: message.id || Date.now().toString(),
                    text: message.content,
                    sender: isMe ? ('me' as const) : ('them' as const),
                    time: new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
                ],
                // Only increment unread if not currently viewing this conversation
                unread: isMe
                  ? conv.unread
                  : isViewingThisChat
                    ? conv.unread
                    : conv.unread + 1,
              };
            });

            // Re-sort: bring the updated conversation to the top
            return updatedChats.sort((a, b) => {
              if (a.id === conversationId) return -1;
              if (b.id === conversationId) return 1;
              return 0;
            });
          };

          setBuyerChats(updateList);
          setSellerChats(updateList);
        };

        socketService.onNewMessage(handleInboxUpdate);

        // VOIP Listeners
        socketService.onCallEvent('call:incoming', async (data: any) => {
          setCallData({
            conversationId: data.conversationId,
            name: data.callerName,
            avatar: data.callerAvatar
          });
          setCallStatus('incoming');
          // Play call ringtone (louder, looping) when an incoming call arrives
          await playCallRingtone();
        });

        socketService.onCallEvent('call:accepted', async (data: any) => {
          // Stop ringing when the recipient accepts
          await stopRingtone();
          setCallStatus('connected');
          const pc = await setupPeerConnection(data.conversationId);
          if (!pc) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketService.sendOffer(data.conversationId, offer);
        });

        socketService.onCallEvent('call:rejected', async () => {
          // FIX 1: Stop ringing when rejected
          await stopRingtone();
          setCallStatus('ended');
          setTimeout(() => setCallStatus('idle'), 2000);
        });

        socketService.onCallEvent('call:ended', async () => {
          // FIX 1: Stop ringing if remote party ends the call
          await stopRingtone();
          setCallStatus('ended');
          setTimeout(() => setCallStatus('idle'), 2000);
        });

        // WebRTC Signaling Handlers
        socketService.onCallEvent('call:offer', async ({ offer, conversationId }: any) => {
          if (isExpoGo) return;
          const { RTCSessionDescription } = require('react-native-webrtc');
          
          if (!peerConnection.current) {
            await setupPeerConnection(conversationId);
          }
          try {
            await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.current!.createAnswer();
            await peerConnection.current!.setLocalDescription(answer);
            socketService.sendAnswer(conversationId, answer);
          } catch (e) {
            console.error('WebRTC offer error:', e);
          }
        });

        socketService.onCallEvent('call:answer', async ({ answer }) => {
          if (isExpoGo) return;
          const { RTCSessionDescription } = require('react-native-webrtc');
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (e) {
            console.error('WebRTC answer error:', e);
          }
        });

        socketService.onCallEvent('call:ice-candidate', async ({ candidate }) => {
          if (isExpoGo) return;
          const { RTCIceCandidate } = require('react-native-webrtc');
          if (!peerConnection.current) return;
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('WebRTC ICE error:', e);
          }
        });

        // Reconnect handler
        const socket = socketService.getSocket();
        if (socket) {
          socket.on('connect', () => {
            console.log('🔄 Socket reconnected, refreshing conversations...');
            fetchChats();
          });
        }
      } catch (error) {
        console.error('Failed to initialize socket:', error);
      }
    };

    initSocket();

    return () => {
      socketService.offNewMessage();
      socketService.offCallEvent('call:incoming');
      socketService.offCallEvent('call:accepted');
      socketService.offCallEvent('call:rejected');
      socketService.offCallEvent('call:ended');
    };
  }, [currentUserId, pathname, searchParams]);

  const setupPeerConnection = async (conversationId: string) => {
    if (isExpoGo) {
      CustomInAppToast.show({ 
        type: 'info', 
        title: 'Not Supported', 
        message: 'Calling is only available in the standalone app build.' 
      });
      return;
    }
    const { RTCPeerConnection, mediaDevices } = require('react-native-webrtc');

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }) as any;

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        socketService.sendIceCandidate(conversationId, event.candidate);
      }
    };

    // FIX 2c: Use ontrack instead of the removed/deprecated onaddstream API
    pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        CustomInAppToast.show({ type: 'error', title: 'Permission Denied', message: 'Microphone access is required for calls.' });
        return;
      }

      // FIX 2d: Set playThroughEarpieceAndroid: false so audio routes to the
      // main speaker on Android and the caller/callee can actually hear each other.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const stream = await (mediaDevices as any).getUserMedia({
        audio: true,
        video: false
      });
      setLocalStream(stream);
      pc.addStream(stream);
    } catch (e) {
      console.error('Failed to get local stream or set audio mode:', e);
    }

    peerConnection.current = pc;
    return pc;
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setRemoteStream(null);
    setCallData(null);
    setIsMuted(false);
    setIsSpeakerOn(false);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = async () => {
    const nextValue = !isSpeakerOn;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: !nextValue,
      });
      setIsSpeakerOn(nextValue);
    } catch (e) {
      console.error('Failed to toggle speaker:', e);
    }
  };

  // ─── Named call control functions ─────────────────────────────────────────
  // These are defined as named consts so both the Provider value AND the
  // CallOverlay JSX props refer to the same implementation.

  /**
   * Initiate an outgoing call.
   * FIX 1: Plays ringtone for the caller while waiting for the other party to answer.
   */
  const startCall = async (id: string, name: string, avatar: string) => {
    setCallData({ conversationId: id, name, avatar });
    setCallStatus('outgoing');
    // Play call ringtone while the other party is being alerted
    await playCallRingtone();
    await socketService.initiateCall(id, name, avatar);
  };

  /**
   * Accept an incoming call.
   * FIX 1: Stops ringtone.
   * FIX 2a: Sets up the peer connection (local stream + ICE + track handler)
   *         BEFORE emitting call:accept to the socket, so the stack is ready
   *         when the offer arrives from the caller.
   */
  const acceptCall = async () => {
    await stopRingtone();
    if (callData) {
      setCallStatus('connected');
      // Must set up PC before signalling accept so the offer can be processed
      await setupPeerConnection(callData.conversationId);
      await socketService.acceptCall(callData.conversationId);
    }
  };

  /**
   * Reject an incoming call.
   * FIX 1: Stops ringtone.
   */
  const rejectCall = async () => {
    await stopRingtone();
    if (callData) {
      setCallStatus('idle');
      await socketService.rejectCall(callData.conversationId);
      cleanupCall();
    }
  };

  /**
   * End an active/outgoing call.
   * FIX 1: Stops ringtone (in case caller ends before answer).
   */
  const endCall = async () => {
    await stopRingtone();
    if (callData) {
      setCallStatus('ended');
      await socketService.endCall(callData.conversationId);
      cleanupCall();
      setTimeout(() => setCallStatus('idle'), 2000);
    }
  };

  // ─── Message helpers ──────────────────────────────────────────────────────

  const sendMessage = async (id: string, text: string, type: 'buyer' | 'seller') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;

    // Optimistic: update last message in list only
    updater((prev: Conversation[]) =>
      prev.map((conv) => (conv.id === id ? { ...conv, lastMessage: text, time } : conv))
    );

    try {
      if (socketService.isConnected()) {
        await socketService.sendMessage(id, text);
      } else {
        await apiSendMessage(id, text);
        fetchChats();
      }
    } catch (error) {
      console.error('Failed to send message', error);
      fetchChats(); // Revert on failure
    }
  };

  const markAsRead = async (id: string, type: 'buyer' | 'seller') => {
    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;
    updater((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));

    try {
      if (socketService.isConnected()) {
        await socketService.markConversationRead(id);
      } else {
        await markConversationRead(id);
      }
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const deleteConversation = async (
    id: string,
    type: 'buyer' | 'seller'
  ): Promise<boolean> => {
    const updater = type === 'buyer' ? setBuyerChats : setSellerChats;
    updater((prev) => prev.filter((c) => c.id !== id));

    try {
      await apiDeleteConversation(id);
      return true;
    } catch (error) {
      console.error('Failed to delete conversation', error);
      fetchChats();
      return false;
    }
  };

  return (
    <ChatContext.Provider
      value={{
        buyerConversations,
        sellerConversations,
        sendMessage,
        markAsRead,
        deleteConversation,
        refresh: fetchChats,
        currentUserId,
        callState,
        callData,
        // FIX 2a: named functions are used, ensuring setupPeerConnection runs
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        isMuted,
        isSpeakerOn,
        toggleMute,
        toggleSpeaker,
      }}
    >
      {children}
      {/* FIX 2a: Use the named call functions as props so all logic
          (peer connection setup + ringtone stop) is always executed */}
      <CallOverlay
        isVisible={callState !== 'idle'}
        status={callState === 'outgoing' ? 'outgoing' : callState === 'incoming' ? 'incoming' : callState === 'connected' ? 'connected' : 'ended'}
        name={callData?.name || 'Unknown'}
        avatar={callData?.avatar || ''}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
      />
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};

export default function NotARoute() {
  return null;
}