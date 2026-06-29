import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { socketService } from '../services/socket';
import { storage, secureStorage, getUserData } from '../services/api';
import { useChatStore } from '../store/chatStore';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { queryKeys } from '@/lib/query/keys';

const getMsgPreview = (msg: any): string => {
  const type = msg?.message_type;
  if (type === 'image') return '📷 Photo';
  if (type === 'video') return '🎥 Video';
  if (type === 'voice') return '🎙️ Voice note';
  if (type === 'sticker') return msg.content || '😊 Sticker';
  return msg?.content || '';
};

function updateConvEntry(
  c: any,
  conversationId: string,
  message: any,
  isMe: string | boolean | null,
  isViewing: boolean
) {
  if (c.id !== conversationId) return c;
  return {
    ...c,
    lastMessage: {
      ...c.lastMessage,
      content: message.content,
      message_type: message.message_type,
      attachment_url: message.attachment_url,
      created_at: message.created_at || message.timestamp,
    },
    updatedAt: message.created_at || message.timestamp,
    unreadCount: isMe || isViewing ? c.unreadCount : (c.unreadCount || 0) + 1,
  };
}

function sortByConversation(a: any, b: any, conversationId: string) {
  if (a.id === conversationId) return -1;
  if (b.id === conversationId) return 1;
  return 0;
}

function applyMessageToConvList(
  prev: any[],
  conversationId: string,
  message: any,
  isMe: string | boolean | null,
  pathnameRef: { current: any },
  conversationIdRef: { current: any },
  queryClient: any,
  convKey: any[]
) {
  if (!prev.some((c: any) => c.id === conversationId)) {
    queryClient.invalidateQueries({ queryKey: convKey });
    return prev;
  }
  const isViewing =
    pathnameRef.current === '/chat/conversation' &&
    conversationIdRef.current === conversationId;
  return prev
    .map((c: any) => updateConvEntry(c, conversationId, message, isMe, isViewing))
    .sort((a: any, b: any) => sortByConversation(a, b, conversationId));
}

export const useSocketSetup = () => {
  const queryClient = useQueryClient();
  const currentUserId = useChatStore((s) => s.currentUserId);
  const setCurrentUserId = useChatStore((s) => s.setCurrentUserId);
  const convKey = queryKeys.chat.conversations();

  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const pathnameRef = useRef(pathname);
  const conversationIdRef = useRef(searchParams?.conversationId);

  useEffect(() => {
    pathnameRef.current = pathname;
    conversationIdRef.current = searchParams?.conversationId;
  }, [pathname, searchParams?.conversationId]);

  useEffect(() => {
    (async () => {
      const token =
        (await secureStorage.getItem('userToken')) ||
        (await secureStorage.getItem('businessToken'));
      if (!token) return;
      let uid = await storage.getItem('userId');
      if (!uid) {
        try {
          const me = await getUserData();
          if (me?.id) {
            uid = me.id;
            await storage.setItem('userId', uid!);
          }
        } catch (e) {
          console.error('Failed to fetch user data for socket setup:', e);
        }
      }
      if (uid) setCurrentUserId(uid);
    })();
  }, []);

  useEffect(() => {
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
            message: getMsgPreview(message),
          });
        }
      }

      queryClient.setQueryData<any[]>(convKey, (prev = []) =>
        applyMessageToConvList(prev, conversationId, message, isMe, pathnameRef, conversationIdRef, queryClient, convKey)
      );
    };

    const initSocket = async () => {
      try {
        const token =
          (await secureStorage.getItem('userToken')) ||
          (await secureStorage.getItem('businessToken'));
        if (!token) return;
        await socketService.connect();
        await socketService.onNewMessage(handleNewMessage);
      } catch (e) {
        console.error('Failed to initialize socket:', e);
      }
    };

    initSocket();
    return () => {
      socketService.offNewMessage(handleNewMessage);
    };
  }, [currentUserId, queryClient]);
};
