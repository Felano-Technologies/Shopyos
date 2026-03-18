// hooks/useProducts.ts
// FIX 1: Corrected staleTime values aligned to Redis cache TTLs.
// - Product list/search: 5 min (matches Redis TTL)
// - Product detail:     10 min (individual product cache is longer)
// - Search queries:     5 min (was 3 min — was causing redundant fetches)
// refetchOnMount is NOT set here so it inherits the global `false` default.
// This means navigating back to Home won't re-fetch if data is still fresh.

import { useQuery, useInfiniteQuery, UseQueryOptions } from '@tanstack/react-query';
import { productsApi, Product } from '../lib/query/api';
import { queryKeys, ProductFilters } from '../lib/query/keys';

export const useProducts = (filters?: ProductFilters, limit = 20) => {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => productsApi.search(undefined, filters, limit, 0),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Inherits refetchOnMount: false from global default
  });
};

export const useInfiniteProducts = (filters?: ProductFilters, limit = 20) => {
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useProduct = (id: string, options?: Partial<UseQueryOptions<Product>>) => {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
    // Product detail pages are fine with 10 min cache
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
    // FIX: was 3 min — increased to 5 min to match Redis search cache TTL.
    // Search results don't change faster than product listings do.
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};