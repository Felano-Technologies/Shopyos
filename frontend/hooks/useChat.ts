import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  getPresence,
} from '@/services/messaging';
import { queryKeys } from '@/lib/query/keys';

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
    refetchOnMount: false,
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
