import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys, StoreFilters } from '@/lib/query/keys';
import { getAllStores, getBusinessById } from '@/services/api';

const PAGE_SIZE = 20;

export const useStores = (filters?: StoreFilters) => {
  return useInfiniteQuery({
    queryKey: queryKeys.stores.infinite(filters),
    queryFn: ({ pageParam }) =>
      getAllStores({ ...filters, limit: PAGE_SIZE, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const p = lastPage?.pagination;
      if (!p?.hasNext) return undefined;
      return p.currentPage * p.itemsPerPage;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
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
