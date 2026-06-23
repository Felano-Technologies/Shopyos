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

export const useOrders = (status?: string) => {
  return useQuery({
    queryKey: queryKeys.orders.list(status),
    queryFn: () => ordersApi.getAll(status),
    refetchOnMount: true,
    staleTime: 30 * 1000,      // 30s
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

// ─── Product mutations with cache invalidation ─────────────────────────

export const useCreateProduct = (storeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productData: any) => createProduct(productData),
    onSuccess: () => {
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
    mutationFn: (files: File[]) => uploadProductImages(productId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(productId),
      });
    },
  });
};
