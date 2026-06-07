import { useQuery } from '@tanstack/react-query';
import { queryKeys, StoreFilters } from '@/lib/query/keys';
import { getAllStores, getBusinessById } from '@/services/api';

export const useStores = (filters?: StoreFilters) => {
  return useQuery({
    queryKey: queryKeys.stores.list(filters),
    queryFn: () => getAllStores(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

export const useStoreDetail = (id: string) => {
  return useQuery({
    queryKey: queryKeys.stores.detail(id),
    queryFn: () => getBusinessById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};
