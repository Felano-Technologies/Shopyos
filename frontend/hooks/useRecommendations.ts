import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/query/keys';
import {
  getSimilarProducts,
  getPersonalizedRecommendations,
  getTrendingRecommendations,
} from '../services/recommendations';
import { useAuthStore } from '../store/authStore';

export const useSimilarProducts = (productId: string) =>
  useQuery({
    queryKey: queryKeys.recommendations.similar(productId),
    queryFn: () => getSimilarProducts(productId),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

export const usePersonalizedRecommendations = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: queryKeys.recommendations.personalized(),
    queryFn: () => getPersonalizedRecommendations(),
    // Account-only endpoint — guests fall back to trending (see RecommendedSection).
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

export const useTrendingRecommendations = (category?: string) =>
  useQuery({
    queryKey: queryKeys.recommendations.trending(category),
    queryFn: () => getTrendingRecommendations(category),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
