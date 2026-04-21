import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import * as ApiService from '@/services/api';
import { socketService } from '@/services/socket';
import { useRouter, usePathname } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { CustomInAppToast } from '@/components/InAppToastHost';
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
export const useUnreadNotificationCount = (enableRealtime: boolean = true) => {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  // Listen for real-time notification events via socket
  useEffect(() => {
    if (!enableRealtime) {
      return;
    }
    let mounted = true;
    let socketRef: any = null;
    const handleNewNotification = (data: any) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
      if (pathname !== '/notification' && data?.title && data?.message) {
        // Play haptic feedback and notification sound
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Audio.Sound.createAsync(
          require('@/assets/sounds/notification.wav'),
          { shouldPlay: true, volume: 0.25 } // soft chime, not full-blast
        )
          .then(({ sound }) => {
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) {
                sound.unloadAsync(); // clean up memory
              }
            });
          })
          .catch((err) => console.warn('Failed to play notification sound:', err));
        CustomInAppToast.show({
          title: data.title,
          message: data.message,
          data: data,
        });
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
          ...(prev || {}),
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
        ...(prev || {}),
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
