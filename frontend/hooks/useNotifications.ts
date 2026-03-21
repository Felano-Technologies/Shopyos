import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import * as ApiService from '@/services/api';
import { socketService } from '@/services/socket';
import Toast from 'react-native-toast-message';
import { useRouter, usePathname } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { CustomInAppToast } from '@/components/InAppToastHost';

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  // Listen for real-time notification events via socket
  useEffect(() => {
    let mounted = true;

    const handleNewNotification = (data: any) => {
      if (!mounted) return;
      // Invalidate both notifications list and unread count so they refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    };

    // Connect socket and listen for notification:new events
    socketService.connect()
      .then((socket) => {
        socket.on('notification:new', handleNewNotification);
      })
      .catch((err) => {
        console.warn('Failed to connect socket for notifications:', err.message);
      });

    return () => {
      mounted = false;
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('notification:new', handleNewNotification);
      }
    };
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const token = await ApiService.storage.getItem('userToken');
      if (!token) return { notifications: [], totalPages: 0, currentPage: 1 };
      
      const response = await ApiService.getNotifications();
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - notifications should be relatively fresh
    gcTime: 10 * 60 * 1000,
  });
};

export const useUnreadNotificationCount = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  // Listen for real-time notification events via socket
  useEffect(() => {
    let mounted = true;

    const handleNewNotification = (data: any) => {
      if (!mounted) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });

      if (pathname !== '/notification' && data?.title && data?.message) {
        // Play haptic feedback and notification sound
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Audio.Sound.createAsync(require('@/assets/sounds/notification.mp3'), { shouldPlay: true })
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

    socketService.connect()
      .then((socket) => {
        socket.on('notification:new', handleNewNotification);
      })
      .catch((err) => {
        console.warn('Failed to connect socket for unread count:', err.message);
      });

    return () => {
      mounted = false;
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('notification:new', handleNewNotification);
      }
    };
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const token = await ApiService.storage.getItem('userToken');
      if (!token) return { unreadCount: 0 };

      const response = await ApiService.getUnreadNotificationCount();
      return response;
    },
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
    onSuccess: () => {
      // Invalidate notifications list to refetch
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
      // Invalidate notifications list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
};
