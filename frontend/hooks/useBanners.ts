import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { getActiveBanners, getPromotedProducts } from '@/services/api';

export const useActiveBanners = () => {
  return useQuery({
    queryKey: queryKeys.banners.active(),
    queryFn: () => getActiveBanners(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

export const usePromotedProducts = () => {
  return useQuery({
    queryKey: queryKeys.banners.promoted(),
    queryFn: () => getPromotedProducts(),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};
