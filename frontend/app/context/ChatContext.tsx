import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getConversations,
  sendMessage as apiSendMessage,
  markConversationRead,
  deleteConversation as apiDeleteConversation,
  storage,
} from '../../services/api';
import { socketService } from '../../services/socket';
import { usePathname, useGlobalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

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
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [buyerConversations, setBuyerChats] = useState<Conversation[]>([]);
  const [sellerConversations, setSellerChats] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const router = useRouter();

  const fetchChats = async () => {
    try {
      const token = await storage.getItem('userToken');
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

        setBuyerChats(formatted);
        setSellerChats(formatted);
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
        const token = await storage.getItem('userToken');
        if (!token) return;

        await socketService.connect();

        const handleInboxUpdate = (data: {
          message: any;
          conversationId: string;
        }) => {
          const { message, conversationId } = data;
          const isMe = currentUserId && message.sender_id === currentUserId;

          // Update the conversation list: bump lastMessage, time, unread count
          const updateList = (prev: Conversation[]) =>
            prev.map((conv) => {
              if (conv.id !== conversationId) return conv;

              const isViewingThisChat =
                pathname === '/chat/conversation' &&
                searchParams?.conversationId === conversationId;

              // Show toast for incoming messages not currently on screen
              if (!isMe && !isViewingThisChat) {
                Toast.show({
                  type: 'info',
                  text1: conv.name,
                  text2: message.content,
                  position: 'top',
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
                    Toast.hide();
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
                // Only increment unread if not currently viewing this conversation
                unread: isMe
                  ? conv.unread
                  : isViewingThisChat
                  ? conv.unread
                  : conv.unread + 1,
              };
            });

          setBuyerChats(updateList);
          setSellerChats(updateList);
        };

        socketService.onNewMessage(handleInboxUpdate);

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
    };
  }, [currentUserId, pathname, searchParams]);

  // Initial fetch
  useEffect(() => {
    fetchChats();
  }, []);

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
      }}
    >
      {children}
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