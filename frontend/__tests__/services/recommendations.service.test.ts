jest.mock('../../services/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  extractErrorMessage: (err: any) => err?.message || 'Error',
}));

import { api } from '../../services/client';
import {
  getSimilarProducts,
  getPersonalizedRecommendations,
  getTrendingRecommendations,
} from '../../services/recommendations';

const mockApi = api as jest.Mocked<typeof api>;

describe('recommendations service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getSimilarProducts', () => {
    test('test_getSimilarProducts_withProductId_callsCorrectEndpoint', async () => {
      const mockData = { success: true, products: [{ id: 'p2' }] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await getSimilarProducts('product-123');

      expect(mockApi.get).toHaveBeenCalledWith('/products/product-123/recommendations', { params: { limit: 10 } });
      expect(result).toEqual(mockData);
    });

    test('test_getSimilarProducts_customLimit_passesLimitParam', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { products: [] } });

      await getSimilarProducts('product-123', 5);

      expect(mockApi.get).toHaveBeenCalledWith('/products/product-123/recommendations', { params: { limit: 5 } });
    });

    test('test_getSimilarProducts_error_throwsError', async () => {
      mockApi.get.mockRejectedValueOnce({ message: 'Not found' });

      await expect(getSimilarProducts('bad-id')).rejects.toThrow('Not found');
    });

    test('test_getSimilarProducts_userMessage_throwsUserMessage', async () => {
      mockApi.get.mockRejectedValueOnce({ userMessage: 'Product unavailable' });

      await expect(getSimilarProducts('p1')).rejects.toThrow('Product unavailable');
    });
  });

  describe('getPersonalizedRecommendations', () => {
    test('test_getPersonalizedRecommendations_success_callsEndpoint', async () => {
      const mockData = { success: true, recommendations: [{ id: 'p1' }] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await getPersonalizedRecommendations();

      expect(mockApi.get).toHaveBeenCalledWith('/recommendations/personalized', { params: { limit: 10 } });
      expect(result).toEqual(mockData);
    });

    test('test_getPersonalizedRecommendations_customLimit_passesLimit', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { recommendations: [] } });

      await getPersonalizedRecommendations(20);

      expect(mockApi.get).toHaveBeenCalledWith('/recommendations/personalized', { params: { limit: 20 } });
    });

    test('test_getPersonalizedRecommendations_error_throwsError', async () => {
      mockApi.get.mockRejectedValueOnce({ message: 'Server error' });

      await expect(getPersonalizedRecommendations()).rejects.toThrow('Server error');
    });
  });

  describe('getTrendingRecommendations', () => {
    test('test_getTrendingRecommendations_noCategory_callsEndpoint', async () => {
      const mockData = { success: true, products: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await getTrendingRecommendations();

      expect(mockApi.get).toHaveBeenCalledWith('/recommendations/trending', { params: { category: undefined, limit: 10 } });
      expect(result).toEqual(mockData);
    });

    test('test_getTrendingRecommendations_withCategory_passesCategory', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { products: [] } });

      await getTrendingRecommendations('electronics', 15);

      expect(mockApi.get).toHaveBeenCalledWith('/recommendations/trending', { params: { category: 'electronics', limit: 15 } });
    });

    test('test_getTrendingRecommendations_error_throwsError', async () => {
      mockApi.get.mockRejectedValueOnce({ userMessage: 'Unavailable' });

      await expect(getTrendingRecommendations()).rejects.toThrow('Unavailable');
    });
  });
});
