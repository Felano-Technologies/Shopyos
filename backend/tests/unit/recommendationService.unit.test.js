'use strict';

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDelPattern = jest.fn();

jest.mock('../../config/redis', () => ({
  cacheGet: (...args) => mockCacheGet(...args),
  cacheSet: (...args) => mockCacheSet(...args),
  cacheDelPattern: (...args) => mockCacheDelPattern(...args),
}));

jest.mock('../../db/repositories', () => ({
  recommendations: {
    getSimilarProducts: jest.fn(),
    getTrending: jest.fn(),
    getPersonalizedForUser: jest.fn(),
    computeCoPurchaseScores: jest.fn(),
    batchUpsertSimilarities: jest.fn(),
  },
}));

const repositories = require('../../db/repositories');
const {
  getRecommendations,
  getPersonalized,
  getTrending,
  computeAndStoreSimilarities,
} = require('../../services/recommendationService');

describe('recommendationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDelPattern.mockResolvedValue(undefined);
  });

  describe('getRecommendations', () => {
    test('returns cached result without hitting repository', async () => {
      const cached = { products: [{ id: 'p1' }], source: 'cf' };
      mockCacheGet.mockResolvedValueOnce(cached);

      const result = await getRecommendations('prod-1', 'user-1', 5);
      expect(result).toEqual(cached);
      expect(repositories.recommendations.getSimilarProducts).not.toHaveBeenCalled();
    });

    test('fetches similar products from repo on cache miss and returns cf source', async () => {
      const products = [{ id: 'p2' }, { id: 'p3' }];
      repositories.recommendations.getSimilarProducts.mockResolvedValueOnce(products);

      const result = await getRecommendations('prod-1', 'user-1', 5);
      expect(result).toEqual({ products, source: 'cf' });
      expect(mockCacheSet).toHaveBeenCalled();
    });

    test('falls back to trending when no similar products found', async () => {
      repositories.recommendations.getSimilarProducts.mockResolvedValueOnce([]);
      const trending = [{ id: 'p5' }];
      repositories.recommendations.getTrending.mockResolvedValueOnce(trending);

      const result = await getRecommendations('prod-1', 'user-1', 5);
      expect(result).toEqual({ products: trending, source: 'trending' });
    });

    test('clamps limit: NaN defaults to 10', async () => {
      repositories.recommendations.getSimilarProducts.mockResolvedValueOnce([]);
      repositories.recommendations.getTrending.mockResolvedValueOnce([]);

      await getRecommendations('prod-1', 'user-1', 'bad');
      expect(repositories.recommendations.getSimilarProducts).toHaveBeenCalledWith('prod-1', 10);
    });

    test('clamps limit: values above 20 capped at 20', async () => {
      repositories.recommendations.getSimilarProducts.mockResolvedValueOnce([]);
      repositories.recommendations.getTrending.mockResolvedValueOnce([]);

      await getRecommendations('prod-1', 'user-1', 100);
      expect(repositories.recommendations.getSimilarProducts).toHaveBeenCalledWith('prod-1', 20);
    });
  });

  describe('getPersonalized', () => {
    test('returns personalized results from repo on cache miss', async () => {
      const products = [{ id: 'p10' }];
      repositories.recommendations.getPersonalizedForUser.mockResolvedValueOnce(products);

      const result = await getPersonalized('user-1', 5);
      expect(result).toEqual({ products, source: 'personalized' });
    });

    test('falls back to trending when no personalized results', async () => {
      repositories.recommendations.getPersonalizedForUser.mockResolvedValueOnce([]);
      repositories.recommendations.getTrending.mockResolvedValueOnce([{ id: 'p99' }]);

      const result = await getPersonalized('user-1', 5);
      expect(result.source).toBe('trending');
    });
  });

  describe('getTrending', () => {
    test('returns trending products from repo on cache miss', async () => {
      const products = [{ id: 'pt1' }];
      repositories.recommendations.getTrending.mockResolvedValueOnce(products);

      const result = await getTrending('electronics', 5);
      expect(result).toEqual({ products, source: 'trending' });
      expect(repositories.recommendations.getTrending).toHaveBeenCalledWith('electronics', 5);
    });
  });

  describe('computeAndStoreSimilarities', () => {
    test('skips upsert when no co-purchase data exists', async () => {
      repositories.recommendations.computeCoPurchaseScores.mockResolvedValueOnce([]);

      await computeAndStoreSimilarities();
      expect(repositories.recommendations.batchUpsertSimilarities).not.toHaveBeenCalled();
    });

    test('upserts both directions and clears cache', async () => {
      const pairs = [{ product_id: 'p1', similar_product_id: 'p2', score: 0.9 }];
      repositories.recommendations.computeCoPurchaseScores.mockResolvedValueOnce(pairs);
      repositories.recommendations.batchUpsertSimilarities.mockResolvedValueOnce(undefined);

      await computeAndStoreSimilarities();

      const upsertArg = repositories.recommendations.batchUpsertSimilarities.mock.calls[0][0];
      expect(upsertArg).toHaveLength(2); // both directions
      expect(upsertArg).toContainEqual({ product_id: 'p1', similar_product_id: 'p2', score: 0.9 });
      expect(upsertArg).toContainEqual({ product_id: 'p2', similar_product_id: 'p1', score: 0.9 });
      expect(mockCacheDelPattern).toHaveBeenCalledWith('shopyos:recommendations:product:*');
    });
  });
});
