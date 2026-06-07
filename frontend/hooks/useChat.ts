import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  deleteConversation as apiDeleteConversation,
  getPresence,
} from '@/services/messaging';
import { queryKeys } from '@/lib/query/keys';
import { socketService } from '@/services/socket';
import { useChatStore } from '@/store/chatStore';

// ── Conversations ────────────────────────────────────────────────────────────

export const useConversations = () => {
  return useQuery({
    queryKey: queryKeys.chat.conversations(),
    queryFn: async () => {
      const res = await getConversations();
      return res?.conversations ?? [];
    },
    refetchOnMount: true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ── Messages ─────────────────────────────────────────────────────────────────

export type MessageItem = {
  id: string;
  content: string;
  created_at: string;
  timestamp?: string;
  createdAt?: string;
  sent_at?: string;
  sender_id: string;
  message_type?: string;
  attachment_url?: string;
  attachment_meta?: any;
  is_read?: boolean;
  is_moderated?: boolean;
  reply_to_message_id?: string;
  reply_to_message?: any;
  sender?: any;
  pending?: boolean;
  failed?: boolean;
};

export const useMessages = (conversationId: string) => {
  const queryClient = useQueryClient();
  const key = queryKeys.chat.messages(conversationId);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await getMessages(conversationId);
      return (res?.messages ?? []) as MessageItem[];
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
  });

  const appendMessage = useCallback(
    (message: MessageItem) => {
      queryClient.setQueryData<MessageItem[]>(key, (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
    },
    [queryClient, key]
  );

  const replaceMessage = useCallback(
    (tempId: string, message: MessageItem) => {
      queryClient.setQueryData<MessageItem[]>(key, (prev = []) => {
        const filtered = prev.filter((m) => m.id !== tempId);
        if (filtered.some((m) => m.id === message.id)) return filtered;
        return [...filtered, message];
      });
    },
    [queryClient, key]
  );

  const updateMessage = useCallback(
    (id: string, updates: Partial<MessageItem>) => {
      queryClient.setQueryData<MessageItem[]>(key, (prev = []) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );
    },
    [queryClient, key]
  );

  const removeMessage = useCallback(
    (id: string) => {
      queryClient.setQueryData<MessageItem[]>(key, (prev = []) =>
        prev.filter((m) => m.id !== id)
      );
    },
    [queryClient, key]
  );

  const setMessages = useCallback(
    (messages: MessageItem[]) => {
      queryClient.setQueryData<MessageItem[]>(key, messages);
    },
    [queryClient, key]
  );

  return { ...query, appendMessage, replaceMessage, updateMessage, removeMessage, setMessages };
};

// ── Send message mutation ────────────────────────────────────────────────────

export const useSendMessage = (
  conversationId: string,
  currentUserId: string | null
) => {
  const queryClient = useQueryClient();
  const key = queryKeys.chat.messages(conversationId);
  const convKey = queryKeys.chat.conversations();

  return useMutation({
    mutationFn: ({
      content,
      replyToMessageId,
    }: {
      content: string;
      replyToMessageId?: string;
    }) => apiSendMessage(conversationId, content, replyToMessageId),

    onMutate: async ({ content, replyToMessageId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageItem[]>(key);
      const tempId = `temp_${Date.now()}`;
      queryClient.setQueryData<MessageItem[]>(key, (prev = []) => [
        ...prev,
        {
          id: tempId,
          content,
          created_at: new Date().toISOString(),
          sender_id: currentUserId ?? '',
          pending: true,
          reply_to_message_id: replyToMessageId,
        },
      ]);
      return { previous, tempId };
    },

    onSuccess: (data, _vars, context) => {
      const sent = data?.message;
      if (!sent || !context) return;
      queryClient.setQueryData<MessageItem[]>(key, (prev = []) => {
        const filtered = prev.filter((m) => m.id !== context.tempId);
        if (filtered.some((m) => m.id === sent.id)) return filtered;
        return [...filtered, { ...sent, pending: false }];
      });
      queryClient.invalidateQueries({ queryKey: convKey });
    },

    onError: (_err, _vars, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<MessageItem[]>(key, (prev = []) =>
          prev.map((m) => (m.id === context.tempId ? { ...m, pending: false, failed: true } : m))
        );
      }
    },
  });
};

// ── Presence ─────────────────────────────────────────────────────────────────

export const usePresence = (userId: string | null) => {
  return useQuery({
    queryKey: queryKeys.chat.presence(userId ?? ''),
    queryFn: () => getPresence(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    select: (data: any) => data?.presence ?? null,
  });
};

// ── Conversation formatting helpers ──────────────────────────────────────────

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
  c?.updatedAt || c?.updated_at || c?.lastMessage?.created_at ||
  c?.lastMessage?.timestamp || c?.lastMessage?.createdAt || null;

const getLastMessagePreview = (msg: any): string => {
  if (!msg) return 'No messages yet';
  const type = msg.message_type;
  if (type === 'image') return '📷 Photo';
  if (type === 'video') return '🎥 Video';
  if (type === 'voice') return '🎙️ Voice note';
  if (type === 'sticker') return msg.content || '😊 Sticker';
  return msg.content || 'No messages yet';
};

const formatConversation = (c: any, currentUserId: string | null) => {
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
  const isMe = currentUserId && c.lastMessage?.sender_id === currentUserId;
  const time = formatSafeTime(resolveConversationTimestamp(c));
  const preview = getLastMessagePreview(c.lastMessage);
  return {
    id: c.id,
    name,
    avatar,
    lastMessage: preview,
    time,
    unread: c.unreadCount || 0,
    online: false,
    messages: c.lastMessage
      ? [{ id: c.lastMessage.id, text: preview, sender: (isMe ? 'me' : 'them') as 'me' | 'them', time }]
      : [],
    otherParticipant: p,
  };
};

const BUYER_FILTER = (c: any) =>
  c.otherParticipant?.store?.id ||
  c.otherParticipant?.id === '00000000-0000-0000-0000-000000000001';

const SELLER_FILTER = (c: any) =>
  !c.otherParticipant?.store?.id &&
  c.otherParticipant?.id !== '00000000-0000-0000-0000-000000000001';

const conversationsQueryOptions = {
  queryFn: async () => {
    const res = await getConversations();
    return (res?.conversations ?? []) as any[];
  },
  refetchOnMount: true as const,
  staleTime: 30 * 1000,
  gcTime: 10 * 60 * 1000,
};

// ── Specialized conversation hooks ────────────────────────────────────────────

export const useBuyerConversations = () => {
  const currentUserId = useChatStore((s) => s.currentUserId);
  const select = useCallback(
    (data: any[]) => data.filter(BUYER_FILTER).map((c) => formatConversation(c, currentUserId)),
    [currentUserId]
  );
  return useQuery({ queryKey: queryKeys.chat.conversations(), ...conversationsQueryOptions, select });
};

export const useSellerConversations = () => {
  const currentUserId = useChatStore((s) => s.currentUserId);
  const select = useCallback(
    (data: any[]) => data.filter(SELLER_FILTER).map((c) => formatConversation(c, currentUserId)),
    [currentUserId]
  );
  return useQuery({ queryKey: queryKeys.chat.conversations(), ...conversationsQueryOptions, select });
};

export const useBuyerUnreadCount = () => {
  const select = useCallback(
    (data: any[]) => data.filter(BUYER_FILTER).reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    []
  );
  return useQuery({ queryKey: queryKeys.chat.conversations(), ...conversationsQueryOptions, select });
};

export const useSellerUnreadCount = () => {
  const select = useCallback(
    (data: any[]) => data.filter(SELLER_FILTER).reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    []
  );
  return useQuery({ queryKey: queryKeys.chat.conversations(), ...conversationsQueryOptions, select });
};

// ── Chat actions hook ─────────────────────────────────────────────────────────

export const useChatActions = () => {
  const queryClient = useQueryClient();
  const convKey = queryKeys.chat.conversations();

  const sendMessage = useCallback(
    async (id: string, text: string) => {
      if (socketService.isConnected()) await socketService.sendMessage(id, text);
      else await apiSendMessage(id, text);
      queryClient.invalidateQueries({ queryKey: convKey });
    },
    [queryClient]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      try { await socketService.markConversationRead(id); } catch {}
      queryClient.invalidateQueries({ queryKey: convKey });
    },
    [queryClient]
  );

  const deleteConversation = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await apiDeleteConversation(id);
        queryClient.setQueryData<any[]>(convKey, (prev = []) => prev.filter((c: any) => c.id !== id));
        return true;
      } catch { return false; }
    },
    [queryClient]
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: convKey });
  }, [queryClient]);

  return { sendMessage, markAsRead, deleteConversation, refresh };
};
