jest.mock('@tanstack/react-query', () => ({
  __esModule: true,
  useQuery: jest.fn(),
}));

jest.mock('@/services/recommendations', () => ({
  __esModule: true,
  getSimilarProducts: jest.fn(),
  getPersonalizedRecommendations: jest.fn(),
  getTrendingRecommendations: jest.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import * as RecommendationsService from '@/services/recommendations';
import {
  useSimilarProducts,
  usePersonalizedRecommendations,
  useTrendingRecommendations,
} from '../../hooks/useRecommendations';
import { queryKeys } from '@/lib/query/keys';

describe('useRecommendations hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('useSimilarProducts', () => {
    test('test_useSimilarProducts_withProductId_invokesUseQueryEnabled', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { products: [] }, isLoading: false });

      useSimilarProducts('product-1');

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.recommendations.similar('product-1'),
        enabled: true,
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (RecommendationsService.getSimilarProducts as jest.Mock).mockResolvedValueOnce({ products: [] });
      await config.queryFn();
      expect(RecommendationsService.getSimilarProducts).toHaveBeenCalledWith('product-1');
    });

    test('test_useSimilarProducts_emptyProductId_disablesQuery', () => {
      (useQuery as jest.Mock).mockReturnValue({ data: undefined });

      useSimilarProducts('');

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        enabled: false,
      }));
    });
  });

  describe('usePersonalizedRecommendations', () => {
    test('test_usePersonalizedRecommendations_validCall_invokesUseQuery', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { recommendations: [] }, isLoading: false });

      const result = usePersonalizedRecommendations();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.recommendations.personalized(),
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (RecommendationsService.getPersonalizedRecommendations as jest.Mock).mockResolvedValueOnce({ recommendations: [] });
      await config.queryFn();
      expect(RecommendationsService.getPersonalizedRecommendations).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('useTrendingRecommendations', () => {
    test('test_useTrendingRecommendations_noCategory_invokesUseQuery', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { products: [] } });

      useTrendingRecommendations();

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.recommendations.trending(undefined),
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (RecommendationsService.getTrendingRecommendations as jest.Mock).mockResolvedValueOnce({ products: [] });
      await config.queryFn();
      expect(RecommendationsService.getTrendingRecommendations).toHaveBeenCalledWith(undefined);
    });

    test('test_useTrendingRecommendations_withCategory_passesCategory', async () => {
      (useQuery as jest.Mock).mockReturnValue({ data: { products: [] } });

      useTrendingRecommendations('electronics');

      expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryKey: queryKeys.recommendations.trending('electronics'),
      }));
      const config = (useQuery as jest.Mock).mock.calls[0][0];
      (RecommendationsService.getTrendingRecommendations as jest.Mock).mockResolvedValueOnce({ products: [] });
      await config.queryFn();
      expect(RecommendationsService.getTrendingRecommendations).toHaveBeenCalledWith('electronics');
    });
  });
});
