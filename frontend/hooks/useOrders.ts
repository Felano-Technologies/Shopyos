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
import { ordersApi } from '../lib/query/api';
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

export const useOrderDetail = (id: string, options?: Record<string, any>) => {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
    refetchOnMount: true,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    ...options,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.products.searchAll() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.products.searchAll() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.products.searchAll() });
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