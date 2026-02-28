import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import * as ApiService from '@/services/api';

interface DeliveryQueryOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export const useAvailableDeliveries = (options?: DeliveryQueryOptions) => {
  return useQuery({
    queryKey: queryKeys.delivery.available(),
    queryFn: async () => {
      const response = await ApiService.getAvailableDeliveries();
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute - available deliveries change frequently
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    refetchInterval: options?.refetchInterval,
  });
};

export const useActiveDeliveries = (options?: DeliveryQueryOptions) => {
  return useQuery({
    queryKey: queryKeys.delivery.active(),
    queryFn: async () => {
      const response = await ApiService.getActiveDeliveries();
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    refetchInterval: options?.refetchInterval,
  });
};

export const useDeliveryDetails = (deliveryId: string) => {
  return useQuery({
    queryKey: queryKeys.delivery.detail(deliveryId),
    queryFn: async () => {
      const response = await ApiService.getDeliveryDetails(deliveryId);
      return response;
    },
    enabled: !!deliveryId,
    staleTime: 30 * 1000, // 30 seconds - active delivery should be very fresh
    gcTime: 5 * 60 * 1000,
  });
};

export const useDriverStats = (timeframe: 'today' | 'week' | 'month' = 'today') => {
  return useQuery({
    queryKey: queryKeys.delivery.stats(timeframe),
    queryFn: async () => {
      const response = await ApiService.getDriverStats(timeframe);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
};

export const useAssignDriver = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      return await ApiService.assignDriver(deliveryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.available() });
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.active() });
    },
  });
};

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ deliveryId, status }: { deliveryId: string; status: string }) => {
      return await ApiService.updateDeliveryStatus(deliveryId, status);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.detail(variables.deliveryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.active() });
      queryClient.invalidateQueries({ queryKey: queryKeys.delivery.stats('today') });
    },
  });
};
