import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';

export const useCategories = () => {
  return useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: categoriesApi.getAll,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000,
  });
};
