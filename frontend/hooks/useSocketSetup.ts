import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { socketService } from '../services/socket';
import { storage, secureStorage, getUserData } from '../services/api';
import { useChatStore } from '../store/chatStore';
import { CustomInAppToast } from '@/components/InAppToastHost';
import { queryKeys } from '@/lib/query/keys';

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
        } catch {}
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
            message: message.content,
          });
        }
      }

      queryClient.setQueryData<any[]>(convKey, (prev = []) => {
        if (!prev.some((c: any) => c.id === conversationId)) {
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
                  lastMessage: {
                    ...c.lastMessage,
                    content: message.content,
                    created_at: message.created_at || message.timestamp,
                  },
                  updatedAt: message.created_at || message.timestamp,
                  unreadCount:
                    isMe || isViewing
                      ? c.unreadCount
                      : (c.unreadCount || 0) + 1,
                }
              : c
          )
          .sort((a: any, b: any) =>
            a.id === conversationId ? -1 : b.id === conversationId ? 1 : 0
          );
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
      socketService.offNewMessage(handleNewMessage);
    };
  }, [currentUserId, queryClient]);
};
