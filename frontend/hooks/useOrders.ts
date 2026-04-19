// hooks/useOrders.ts
// FIX 4 (partial) + FIX 5: Order and business hooks with correct cache behaviour.
//
// Fix 4 note: The main token refresh + socket update is in services/api.ts.
// These hooks ensure order data is always fresh (refetchOnMount: true) since
// order status changes frequently and stale order data is user-visible.
//
// Fix 5: useMutations for product create/update/delete now call
// queryClient.invalidateQueries after success so the UI reflects changes
// immediately without waiting for staleTime to expire.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi, businessApi } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
} from '../services/api';

// ─── Orders ───────────────────────────────────────────────────────────────────

export const useOrders = (status?: string, page?: number, PAGE_SIZE?: number) => {
  return useQuery({
    queryKey: queryKeys.orders.list(status),
    queryFn: () => ordersApi.getAll(status),
    // Orders change frequently — always fetch fresh on screen mount
    refetchOnMount: true,
    // Keep stale data visible while fetching (no loading flash)
    staleTime: 30 * 1000,      // 30s — short because order status updates matter
    gcTime: 10 * 60 * 1000,
  });
};

export const useOrderDetail = (id: string) => {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
    refetchOnMount: true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ─── Business / Store ─────────────────────────────────────────────────────────

export const useMyBusinesses = () => {
  return useQuery({
    queryKey: queryKeys.business.list(),
    queryFn: () => businessApi.getMyBusinesses(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Business list is stable — don't refetch unless stale
    refetchOnMount: false,
  });
};

export const useBusinessDashboard = (businessId: string) => {
  return useQuery({
    queryKey: queryKeys.business.dashboard(businessId),
    queryFn: () => businessApi.getDashboard(businessId),
    enabled: !!businessId,
    // Dashboard numbers change — always refetch on mount
    refetchOnMount: true,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useBusinessAnalytics = (
  businessId: string,
  timeframe: 'week' | 'month' | 'year'
) => {
  return useQuery({
    queryKey: queryKeys.business.analytics(businessId, timeframe),
    queryFn: () => businessApi.getAnalytics(businessId, timeframe),
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
};

export const useStoreOrders = (
  storeId: string,
  status?: string
) => {
  return useQuery({
    queryKey: queryKeys.business.orders(storeId, status),
    queryFn: () => businessApi.getStoreOrders(storeId, { status }),
    enabled: !!storeId,
    refetchOnMount: true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useStoreProducts = (storeId: string) => {
  return useQuery({
    queryKey: queryKeys.business.products(storeId),
    queryFn: () => businessApi.getStoreProducts(storeId),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
};

// ─── FIX 5: Product mutations with cache invalidation ─────────────────────────
// Previously mutations called the API directly with no cache update.
// These hooks invalidate the correct query keys on success so the UI
// reflects the change immediately — no stale listings.

export const useCreateProduct = (storeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productData: any) => createProduct(productData),
    onSuccess: () => {
      // New product should appear in store listing and search immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.business.products(storeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
    },
  });
};

export const useUpdateProduct = (productId: string, storeId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productData: any) => updateProduct(productId, productData),
    onSuccess: () => {
      // Invalidate this product's detail and any listings it appears in
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId),
      });
      if (storeId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.business.products(storeId),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
    },
  });
};

export const useDeleteProduct = (storeId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => deleteProduct(productId, storeId),
    onSuccess: (_, productId) => {
      // Remove the deleted product from cache entirely
      queryClient.removeQueries({
        queryKey: queryKeys.products.detail(productId),
      });
      if (storeId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.business.products(storeId),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
      queryClient.invalidateQueries({ queryKey: ['products', 'search'] });
    },
  });
};

export const useUploadProductImages = (productId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageUris: string[]) => uploadProductImages(productId, imageUris),
    onSuccess: () => {
      // Refresh product detail so new images show immediately
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId),
      });
    },
  });
};