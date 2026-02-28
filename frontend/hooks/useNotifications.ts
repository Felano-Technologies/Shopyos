import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import * as ApiService from '@/services/api';

export const useNotifications = () => {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const response = await ApiService.getNotifications();
      return response;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - notifications should be relatively fresh
    gcTime: 10 * 60 * 1000,
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
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
