// hooks/usePromoCodes.ts
// Seller & admin promo code creation/management.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/query/keys';
import {
  createPromoCode,
  getMyPromoCodes,
  deactivatePromoCode,
  adminCreatePromoCode,
  getAdminPromoCodes,
  PromoCodePayload,
} from '../services/api';

export const useMyPromoCodes = () => {
  return useQuery({
    queryKey: queryKeys.promoCodes.mine(),
    queryFn: async () => {
      const res = await getMyPromoCodes();
      return res.data || [];
    },
    staleTime: 60 * 1000,
  });
};

export const useCreatePromoCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PromoCodePayload) => createPromoCode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promoCodes.mine() });
    },
  });
};

export const useDeactivatePromoCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivatePromoCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promoCodes.all });
    },
  });
};

export const useAdminPromoCodes = (filters?: { storeId?: string; isActive?: boolean }) => {
  return useQuery({
    queryKey: queryKeys.promoCodes.admin(filters),
    queryFn: async () => {
      const res = await getAdminPromoCodes(filters);
      return res.data || [];
    },
    staleTime: 60 * 1000,
  });
};

export const useAdminCreatePromoCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PromoCodePayload) => adminCreatePromoCode(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promoCodes.all });
    },
  });
};
