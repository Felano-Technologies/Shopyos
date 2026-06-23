import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { productsApi } from '../lib/query/api';
import type { Product } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';
import type { ProductFilters } from '../lib/query/keys';
import { useAuthStore } from '../store/authStore';

export const useProducts = (filters?: ProductFilters, limit = 20) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => productsApi.search(undefined, filters, limit, 0),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useInfiniteProducts = (filters?: ProductFilters, limit = 20) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useInfiniteQuery({
    queryKey: queryKeys.products.infinite(filters),
    queryFn: ({ pageParam = 0 }) =>
      productsApi.search(undefined, filters, limit, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.success || !lastPage.products || lastPage.products.length < limit) {
        return undefined;
      }
      return allPages.length * limit;
    },
    initialPageParam: 0,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useProduct = (id: string, options?: Partial<UseQueryOptions<Product>>) => {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    ...options,
  });
};

export const useProductSearch = (
  query: string,
  filters?: ProductFilters,
  limit = 20
) => {
  return useQuery({
    queryKey: queryKeys.products.search(query, filters),
    queryFn: () => productsApi.search(query, filters, limit, 0),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
