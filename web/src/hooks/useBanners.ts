import { useQuery } from '@tanstack/react-query';
import { getActiveBanners } from '../services/advertising';
import { queryKeys } from '../lib/query/keys';

export const useActiveBanners = () => {
  return useQuery({
    queryKey: queryKeys.banners.active(),
    queryFn: getActiveBanners,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};
