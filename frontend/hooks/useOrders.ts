import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';

export const useOrders = (status?: string, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return useQuery({
    queryKey: [...queryKeys.orders.list(status), page, limit],
    queryFn: () => ordersApi.getAll(status, limit, offset),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: (prev) => prev, // keep previous page visible while next loads
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
