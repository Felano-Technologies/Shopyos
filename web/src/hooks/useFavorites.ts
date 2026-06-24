import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { favoritesApi } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';

export const useFavorites = () => {
  return useQuery({
    queryKey: queryKeys.favorites.list(),
    queryFn: favoritesApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: favoritesApi.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.list() });
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: favoritesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.list() });
    },
  });
};
