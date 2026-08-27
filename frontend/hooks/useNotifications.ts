import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import * as ApiService from '@/services/api';
import { socketService } from '@/services/socket';
import { usePathname } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { CustomInAppToast } from '@/components/InAppToastHost';

function unloadOnFinish(sound: any, status: any) {
  if (status.isLoaded && status.didJustFinish) {
    sound.unloadAsync();
  }
}
export const useNotifications = () => {
  const queryClient = useQueryClient();
  // Listen for real-time notification events via socket
  useEffect(() => {
    let mounted = true;
    let socketRef: any = null;
    const handleNewNotification = (data: any) => {
      if (!mounted) return;
      // Invalidate both notifications list and unread count so they refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    };

    const init = async () => {
      const token = await ApiService.secureStorage.getItem('userToken') ||
        await ApiService.secureStorage.getItem('businessToken');
      if (!token) return;

      socketService.connect()
        .then((socket) => {
          socketRef = socket;
          socket.on('notification:new', handleNewNotification);
        })
        .catch((err) => {
          console.warn('Failed to connect socket for notifications:', err.message);
        });
    };

    init();

    return () => {
      mounted = false;
      if (socketRef) {
        socketRef.off('notification:new', handleNewNotification);
      }
    };
  }, [queryClient]);
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const token = await ApiService.secureStorage.getItem('userToken') || 
                   await ApiService.secureStorage.getItem('businessToken');
      if (!token) return { notifications: [], unreadCount: 0 };
      
      const response = await ApiService.getNotifications();
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - notifications should be relatively fresh
    gcTime: 10 * 60 * 1000,
  });
};
// How long to wait for more notification:new events before showing a toast.
// Coalesces bursts (e.g. the missed-notifications replay on reconnect, which
// can fire dozens of events back-to-back) into a single summary toast instead
// of one popup per event, while still showing a normal single toast promptly
// for the common case of one live notification arriving on its own.
const NOTIFICATION_BATCH_WINDOW_MS = 600;

export const useUnreadNotificationCount = (enableRealtime: boolean = true) => {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const pendingToastsRef = useRef<any[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Listen for real-time notification events via socket
  useEffect(() => {
    if (!enableRealtime) {
      return;
    }
    let mounted = true;
    let socketRef: any = null;

    const playNotificationFeedback = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Audio.Sound.createAsync(
        require('@/assets/sounds/notification.wav'),
        { shouldPlay: true, volume: 0.25 } // soft chime, not full-blast
      )
        .then(({ sound }) => {
          sound.setOnPlaybackStatusUpdate((status: any) => unloadOnFinish(sound, status));
        })
        .catch((err) => console.warn('Failed to play notification sound:', err));
    };

    const flushPendingToasts = () => {
      batchTimerRef.current = null;
      const batch = pendingToastsRef.current;
      pendingToastsRef.current = [];
      if (!mounted || batch.length === 0) return;

      playNotificationFeedback();
      if (batch.length === 1) {
        const data = batch[0];
        CustomInAppToast.show({ title: data.title, message: data.message, data });
      } else {
        // Omitting `data` here is deliberate — InAppToastHost falls back to
        // navigating to /notification (the full list) when no orderId is
        // present, which is the right destination for a multi-item summary.
        CustomInAppToast.show({
          title: 'New Notifications',
          message: `You have ${batch.length} new notifications`,
        });
      }
    };

    const handleNewNotification = (data: any) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      // Skip the toast for whatever conversation the user is actively inside
      // (tracked globally by conversation.tsx while mounted) — they already
      // see the message live via the chat screen's own socket listener, so a
      // toast on top is a redundant duplicate. Applies to every conversation,
      // not just the bot.
      const activeConversationId = (globalThis as any).activeConversationId;
      const notificationConversationId = data?.data?.conversationId;
      const isForActiveConversation =
        activeConversationId && notificationConversationId && activeConversationId === notificationConversationId;
      if (pathname !== '/notification' && !isForActiveConversation && data?.title && data?.message) {
        pendingToastsRef.current.push(data);
        if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
        batchTimerRef.current = setTimeout(flushPendingToasts, NOTIFICATION_BATCH_WINDOW_MS);
      }
    };
    const init = async () => {
      const token = await ApiService.secureStorage.getItem('userToken') ||
        await ApiService.secureStorage.getItem('businessToken');
      if (!token) return;

      socketService.connect()
        .then((socket) => {
          socketRef = socket;
          socket.on('notification:new', handleNewNotification);
        })
        .catch((err) => {
          console.warn('Failed to connect socket for unread count:', err.message);
        });
    };

    init();

    return () => {
      mounted = false;
      if (socketRef) {
        socketRef.off('notification:new', handleNewNotification);
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      pendingToastsRef.current = [];
    };
  }, [enableRealtime, pathname, queryClient]);
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const token = await ApiService.secureStorage.getItem('userToken') ||
                   await ApiService.secureStorage.getItem('businessToken');
      if (!token) return { unreadCount: 0 };
      const response = await ApiService.getUnreadNotificationCount();
      return response;
    },
    // This endpoint is lightweight; always refresh when a screen using it mounts.
    refetchOnMount: 'always',
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
};
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      return await ApiService.markNotificationRead(notificationId);
    },
    onSuccess: (_data, notificationId) => {
      // Optimistically update cached list item read state
      queryClient.setQueryData(queryKeys.notifications.list(), (prev: any) => {
        if (!prev?.notifications) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n: any) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        };
      });
      // Optimistically decrement unread badge count
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (prev: any) => {
        const current = Number(prev?.unreadCount || 0);
        return {
          ...prev,
          unreadCount: Math.max(0, current - 1)
        };
      });
      // Keep server state authoritative
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await ApiService.markAllNotificationsRead();
    },
    onSuccess: () => {
      // Optimistically clear unread state across the app
      queryClient.setQueryData(queryKeys.notifications.unreadCount(), (prev: any) => ({
        ...prev,
        unreadCount: 0
      }));
      queryClient.setQueryData(queryKeys.notifications.list(), (prev: any) => {
        if (!prev?.notifications) return prev;
        return {
          ...prev,
          notifications: prev.notifications.map((n: any) => ({ ...n, is_read: true }))
        };
      });
      // Invalidate notifications list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};
