import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';

export const useOrders = (status?: string, limit = 20, offset = 0) => {
  return useQuery({
    queryKey: queryKeys.orders.list(status),
    queryFn: () => ordersApi.getAll(status, limit, offset),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};
