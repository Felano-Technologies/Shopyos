import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  sendMessage as apiSendMessage,
  deleteConversation as apiDeleteConversation,
  storage,
  secureStorage
} from '../services/api';
import { socketService } from '../services/socket';
import { usePathname, useGlobalSearchParams, useRouter } from 'expo-router';
import { CustomInAppToast } from "@/components/InAppToastHost";
import { useConversations } from '@/hooks/useChat';
import { queryKeys } from '@/lib/query/keys';
import { getUserData } from '../services/api';
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

const parseSafeDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatSafeTime = (value?: string | null) => {
  const d = parseSafeDate(value);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const resolveConversationTimestamp = (c: any) =>
  c?.updatedAt ||
  c?.updated_at ||
  c?.lastMessage?.created_at ||
  c?.lastMessage?.timestamp ||
  c?.lastMessage?.createdAt ||
  null;

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const convKey = queryKeys.chat.conversations();

  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const pathnameRef = React.useRef(pathname);
  const conversationIdRef = React.useRef(searchParams?.conversationId);
  useEffect(() => {
    pathnameRef.current = pathname;
    conversationIdRef.current = searchParams?.conversationId;
  }, [pathname, searchParams?.conversationId]);

  // Load current user ID once
  useEffect(() => {
    (async () => {
      const token = await secureStorage.getItem('userToken') || await secureStorage.getItem('businessToken');
      if (!token) return;
      let uid = await storage.getItem('userId');
      if (!uid) {
        try {
          const me = await getUserData();
          if (me?.id) { uid = me.id; await storage.setItem('userId', uid!); }
        } catch {}
      }
      if (uid) setCurrentUserId(uid);
    })();
  }, []);

  // TanStack Query — fetch raw conversations
  const { data: rawConversations = [] } = useConversations();

  // Derive formatted conversations
  const allConversations: Conversation[] = useMemo(() => {
    return rawConversations.map((c: any) => {
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
      const isMe = currentUserId && lastMsgSenderId === currentUserId;
      const time = formatSafeTime(resolveConversationTimestamp(c));
      return {
        id: c.id,
        name,
        avatar,
        lastMessage: c.lastMessage?.content || 'No messages yet',
        time,
        unread: c.unreadCount || 0,
        online: false,
        messages: c.lastMessage
          ? [{ id: c.lastMessage.id, text: c.lastMessage.content, sender: (isMe ? 'me' : 'them') as 'me' | 'them', time }]
          : [],
        otherParticipant: p,
      };
    });
  }, [rawConversations, currentUserId]);

  const buyerConversations = useMemo(
    () => allConversations.filter(c => c.otherParticipant?.store?.id || c.otherParticipant?.id === '00000000-0000-0000-0000-000000000001'),
    [allConversations]
  );
  const sellerConversations = useMemo(
    () => allConversations.filter(c => !c.otherParticipant?.store?.id && c.otherParticipant?.id !== '00000000-0000-0000-0000-000000000001'),
    [allConversations]
  );

  // Socket: new message → update cache directly then invalidate
  useEffect(() => {
    let isMounted = true;
    const handleNewMessage = (data: any) => {
      const { message, conversationId } = data;
      const isMe = currentUserId && message.sender_id === currentUserId;

      if (!isMe) {
        const isViewing =
          pathnameRef.current === '/chat/conversation' &&
          conversationIdRef.current === conversationId;
        if (!isViewing) {
          const isBot = message.sender_id === '00000000-0000-0000-0000-000000000001';
          CustomInAppToast.show({
            type: 'info',
            title: isBot ? 'Shopyos Bot' : 'New Message',
            message: message.content,
          });
        }
      }

      // Update conversation list cache optimistically
      queryClient.setQueryData<any[]>(convKey, (prev = []) => {
        if (!prev.some((c: any) => c.id === conversationId)) {
          // Unknown conversation — trigger refetch
          queryClient.invalidateQueries({ queryKey: convKey });
          return prev;
        }
        const isViewing =
          pathnameRef.current === '/chat/conversation' &&
          conversationIdRef.current === conversationId;
        return prev
          .map((c: any) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: { ...c.lastMessage, content: message.content, created_at: message.created_at || message.timestamp },
                  updatedAt: message.created_at || message.timestamp,
                  unreadCount: isMe || isViewing ? c.unreadCount : (c.unreadCount || 0) + 1,
                }
              : c
          )
          .sort((a: any, b: any) => (a.id === conversationId ? -1 : b.id === conversationId ? 1 : 0));
      });
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
  }, [currentUserId, queryClient]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: convKey });
  }, [queryClient]);

  const sendMessage = async (id: string, text: string, _type: 'buyer' | 'seller') => {
    if (socketService.isConnected()) await socketService.sendMessage(id, text);
    else await apiSendMessage(id, text);
    queryClient.invalidateQueries({ queryKey: convKey });
  };

  const markAsRead = async (id: string) => {
    try { await socketService.markConversationRead(id); } catch {}
    queryClient.invalidateQueries({ queryKey: convKey });
  };

  const deleteConversation = async (id: string) => {
    try {
      await apiDeleteConversation(id);
      queryClient.setQueryData<any[]>(convKey, (prev = []) => prev.filter((c: any) => c.id !== id));
      return true;
    } catch { return false; }
  };

  return (
    <ChatContext.Provider value={{ buyerConversations, sellerConversations, sendMessage, markAsRead, deleteConversation, refresh, currentUserId }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const c = useContext(ChatContext);
  if (!c) throw new Error('useChat must be used within a ChatProvider');
  return c;
};
