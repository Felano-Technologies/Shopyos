import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { favoritesApi, Product } from '../lib/query/api';
import { queryKeys } from '../lib/query/keys';
import { Alert } from 'react-native';

export const useFavorites = () => {
  return useQuery({
    queryKey: queryKeys.favorites.list(),
    queryFn: favoritesApi.getAll,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

export const useIsFavorite = (productId: string) => {
  return useQuery({
    queryKey: ['favorites', 'check', productId],
    queryFn: () => favoritesApi.check(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAddFavorite = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (productId: string) => favoritesApi.add(productId),
    
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites.list() });
      
      const previousFavorites = queryClient.getQueryData<Product[]>(queryKeys.favorites.list());
      
      const product = queryClient.getQueryData<Product>(queryKeys.products.detail(productId));
      
      if (product) {
        queryClient.setQueryData<Product[]>(queryKeys.favorites.list(), (old) => {
          if (!old) return [product];
          return [...old, product];
        });
      }
      
      return { previousFavorites };
    },
    
    onError: (error: any, variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKeys.favorites.list(), context.previousFavorites);
      }
      
      Alert.alert('Error', error.userMessage || 'Failed to add to favorites');
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.list() });
    },
  });
};

export const useRemoveFavorite = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (productId: string) => favoritesApi.remove(productId),
    
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites.list() });
      
      const previousFavorites = queryClient.getQueryData<Product[]>(queryKeys.favorites.list());
      
      queryClient.setQueryData<Product[]>(queryKeys.favorites.list(), (old) => {
        if (!old) return old;
        return old.filter(product => product.id !== productId);
      });
      
      return { previousFavorites };
    },
    
    onError: (error: any, variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKeys.favorites.list(), context.previousFavorites);
      }
      
      Alert.alert('Error', error.userMessage || 'Failed to remove from favorites');
    },
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.list() });
    },
  });
};
