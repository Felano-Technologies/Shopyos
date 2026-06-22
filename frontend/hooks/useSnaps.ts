import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';
import { getSnapFeed, getMySnaps } from '@/services/api';

export const useSnapFeed = () => {
  return useQuery({
    queryKey: queryKeys.snaps.feed(),
    queryFn: () => getSnapFeed(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

export const useMySnaps = (status?: string) => {
  return useQuery({
    queryKey: queryKeys.snaps.mySnaps(status),
    queryFn: () => getMySnaps(status),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
};
