import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getConversations,
  getUserData,
  sendMessage as apiSendMessage,
  deleteConversation as apiDeleteConversation,
  storage,
  secureStorage
} from '../services/api';
import { socketService } from '../services/socket';
import { usePathname, useGlobalSearchParams, useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import Constants from 'expo-constants';
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
  const pathnameRef = React.useRef(pathname);
  const conversationIdRef = React.useRef(searchParams?.conversationId);
  useEffect(() => {
    pathnameRef.current = pathname;
    conversationIdRef.current = searchParams?.conversationId;
  }, [pathname, searchParams?.conversationId]);
  const fetchChats = async () => {
    try {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (!token) return;
      let activeUserId = await storage.getItem('userId');
      if (!activeUserId) {
        try {
          const me = await getUserData();
          if (me?.id) {
            activeUserId = me.id;
            await storage.setItem('userId', activeUserId!);
          }
        } catch {}
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
    const initSocket = async () => {
      try {
        const token =
          (await secureStorage.getItem('userToken')) ||
          (await secureStorage.getItem('businessToken'));
        if (!token) return;
        await socketService.connect();
        await socketService.onNewMessage(handleNewMessage);
      } catch {}
    };
    initSocket();
    return () => {
      isMounted = false;
      socketService.offNewMessage(handleNewMessage);
    };
  }, [currentUserId]);

  useEffect(() => { fetchChats(); }, []);
  const sendMessage = async (id: string, text: string, type: 'buyer' | 'seller') => { if (socketService.isConnected()) await socketService.sendMessage(id, text); else await apiSendMessage(id, text); fetchChats(); };
  const markAsRead = async (id: string) => { try { await socketService.markConversationRead(id); } catch {} fetchChats(); };
  const deleteConversation = async (id: string) => { try { await apiDeleteConversation(id); return true; } catch { return false; } finally { fetchChats(); } };
  return (
    <ChatContext.Provider value={{ buyerConversations, sellerConversations, sendMessage, markAsRead, deleteConversation, refresh: fetchChats, currentUserId }}>
      {children}
    </ChatContext.Provider>
  );
};
export const useChat = () => { const c = useContext(ChatContext); if (!c) throw new Error('useChat must be used within a ChatProvider'); return c; };