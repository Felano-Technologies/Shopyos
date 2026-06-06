'use strict';

/**
 * tests/unit/cacheInvalidation.unit.test.js
 *
 * Unit tests for config/cacheInvalidation.js.
 * Mocks ../config/redis and ../config/logger so no real Redis connection
 * or logging side-effects occur.
 * Conforms to guidelines/test.md.
 */

// ── Mock redis before requiring the module under test ───────────────────────
jest.mock('../../config/redis', () => ({
  cacheDel: jest.fn().mockResolvedValue(1),
  cacheDelPattern: jest.fn().mockResolvedValue(1),
}));

jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { cacheDel, cacheDelPattern } = require('../../config/redis');

const {
  invalidateProduct,
  invalidateStore,
  invalidateCategories,
  invalidateReviews,
  invalidateOrderProducts,
} = require('../../config/cacheInvalidation');

describe('cacheInvalidation Unit Tests', () => {
  beforeEach(() => {
    cacheDel.mockClear();
    cacheDelPattern.mockClear();
  });

  // ── invalidateProduct ───────────────────────────────────────────────────────
  describe('invalidateProduct', () => {
    test('test_invalidateProduct_withProductId_callsCacheDelForProductDetail', async () => {
      // Arrange & Act
      await invalidateProduct('prod-123', undefined);
      // Assert — cacheDel should be called with an array containing the product detail key
      const allDelCalls = cacheDel.mock.calls.flat(2);
      expect(allDelCalls).toContain('shopyos:products:detail:prod-123');
    });

    test('test_invalidateProduct_withProductId_invalidatesProductSearchPattern', async () => {
      // Arrange & Act
      await invalidateProduct('prod-123', undefined);
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:products:search:*');
    });

    test('test_invalidateProduct_withProductId_invalidatesCategoriesPattern', async () => {
      // Arrange & Act
      await invalidateProduct('prod-123', undefined);
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:categories:*');
    });

    test('test_invalidateProduct_withStoreId_invalidatesStoreProductsPattern', async () => {
      // Arrange & Act
      await invalidateProduct('prod-456', 'store-789');
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:products:store:store-789:*');
    });

    test('test_invalidateProduct_withoutStoreId_doesNotInvalidateStorePattern', async () => {
      // Arrange & Act
      await invalidateProduct('prod-456', undefined);
      // Assert — no store-specific pattern key should appear
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      const storePatternCalled = patternCalls.some(k => k.includes('store:'));
      expect(storePatternCalled).toBe(false);
    });

    test('test_invalidateProduct_called_resolves', async () => {
      // Arrange & Act & Assert
      await expect(invalidateProduct('prod-999', 'store-111')).resolves.toBeUndefined();
    });
  });

  // ── invalidateStore ─────────────────────────────────────────────────────────
  describe('invalidateStore', () => {
    test('test_invalidateStore_withStoreId_callsCacheDelForStoreDetail', async () => {
      // Arrange & Act
      await invalidateStore('store-42');
      // Assert
      const allDelArgs = cacheDel.mock.calls.map(c => c[0]);
      expect(allDelArgs).toContain('shopyos:stores:detail:store-42');
    });

    test('test_invalidateStore_withStoreId_callsCacheDelForFeaturedStores', async () => {
      // Arrange & Act
      await invalidateStore('store-42');
      // Assert
      const allDelArgs = cacheDel.mock.calls.map(c => c[0]);
      expect(allDelArgs).toContain('shopyos:stores:featured');
    });

    test('test_invalidateStore_withStoreId_invalidatesAllStoresPattern', async () => {
      // Arrange & Act
      await invalidateStore('store-42');
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:stores:all:*');
    });

    test('test_invalidateStore_called_resolves', async () => {
      // Arrange & Act & Assert
      await expect(invalidateStore('store-99')).resolves.toBeUndefined();
    });

    test('test_invalidateStore_called_invokesCacheDelTwice', async () => {
      // Arrange & Act
      await invalidateStore('store-77');
      // Assert — detail key + featured key = 2 cacheDel calls
      expect(cacheDel).toHaveBeenCalledTimes(2);
    });
  });

  // ── invalidateCategories ────────────────────────────────────────────────────
  describe('invalidateCategories', () => {
    test('test_invalidateCategories_called_invokesCacheDelPatternWithCategoryWildcard', async () => {
      // Arrange & Act
      await invalidateCategories();
      // Assert
      expect(cacheDelPattern).toHaveBeenCalledWith('shopyos:categories:*');
    });

    test('test_invalidateCategories_called_invokesCacheDelPatternExactlyOnce', async () => {
      // Arrange & Act
      await invalidateCategories();
      // Assert
      expect(cacheDelPattern).toHaveBeenCalledTimes(1);
    });

    test('test_invalidateCategories_called_doesNotInvokeCacheDel', async () => {
      // Arrange & Act
      await invalidateCategories();
      // Assert — only pattern-based deletion is needed
      expect(cacheDel).not.toHaveBeenCalled();
    });

    test('test_invalidateCategories_called_resolves', async () => {
      // Arrange & Act & Assert
      await expect(invalidateCategories()).resolves.toBeUndefined();
    });
  });

  // ── invalidateReviews ───────────────────────────────────────────────────────
  describe('invalidateReviews', () => {
    test('test_invalidateReviews_withProductId_invalidatesProductReviewPattern', async () => {
      // Arrange & Act
      await invalidateReviews('prod-11', undefined);
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:reviews:product:prod-11:*');
    });

    test('test_invalidateReviews_withProductId_callsCacheDelForProductDetail', async () => {
      // Arrange & Act
      await invalidateReviews('prod-11', undefined);
      // Assert
      const allDelArgs = cacheDel.mock.calls.map(c => c[0]);
      expect(allDelArgs).toContain('shopyos:products:detail:prod-11');
    });

    test('test_invalidateReviews_withStoreId_invalidatesStoreReviewPattern', async () => {
      // Arrange & Act
      await invalidateReviews(undefined, 'store-22');
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:reviews:store:store-22:*');
    });

    test('test_invalidateReviews_withBothIds_invalidatesBothPatterns', async () => {
      // Arrange & Act
      await invalidateReviews('prod-33', 'store-44');
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:reviews:product:prod-33:*');
      expect(patternCalls).toContain('shopyos:reviews:store:store-44:*');
    });

    test('test_invalidateReviews_withNoIds_performsNoOperations', async () => {
      // Arrange & Act
      await invalidateReviews(undefined, undefined);
      // Assert — no operations should be queued
      expect(cacheDel).not.toHaveBeenCalled();
      expect(cacheDelPattern).not.toHaveBeenCalled();
    });

    test('test_invalidateReviews_called_resolves', async () => {
      // Arrange & Act & Assert
      await expect(invalidateReviews('prod-55', 'store-66')).resolves.toBeUndefined();
    });
  });

  // ── invalidateOrderProducts ─────────────────────────────────────────────────
  describe('invalidateOrderProducts', () => {
    test('test_invalidateOrderProducts_withItems_callsCacheDelForEachProductDetail', async () => {
      // Arrange
      const items = [
        { product_id: 'p1' },
        { product_id: 'p2' },
        { product_id: 'p3' },
      ];
      // Act
      await invalidateOrderProducts(items, undefined);
      // Assert — one cacheDel per item
      const allDelArgs = cacheDel.mock.calls.map(c => c[0]);
      expect(allDelArgs).toContain('shopyos:products:detail:p1');
      expect(allDelArgs).toContain('shopyos:products:detail:p2');
      expect(allDelArgs).toContain('shopyos:products:detail:p3');
    });

    test('test_invalidateOrderProducts_withItems_invalidatesSearchPattern', async () => {
      // Arrange
      const items = [{ product_id: 'p10' }];
      // Act
      await invalidateOrderProducts(items, undefined);
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:products:search:*');
    });

    test('test_invalidateOrderProducts_withStoreId_invalidatesStoreProductsPattern', async () => {
      // Arrange
      const items = [{ product_id: 'p20' }];
      // Act
      await invalidateOrderProducts(items, 'store-50');
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:products:store:store-50:*');
    });

    test('test_invalidateOrderProducts_withoutStoreId_doesNotInvalidateStorePattern', async () => {
      // Arrange
      const items = [{ product_id: 'p30' }];
      // Act
      await invalidateOrderProducts(items, undefined);
      // Assert
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      const hasStorePatt = patternCalls.some(k => k.includes('store:'));
      expect(hasStorePatt).toBe(false);
    });

    test('test_invalidateOrderProducts_emptyItemsArray_callsCacheDelZeroTimesForProducts', async () => {
      // Arrange
      const items = [];
      // Act
      await invalidateOrderProducts(items, undefined);
      // Assert — no product-detail cacheDel calls
      expect(cacheDel).not.toHaveBeenCalled();
    });

    test('test_invalidateOrderProducts_emptyItemsArray_stillInvalidatesSearchPattern', async () => {
      // Arrange & Act
      await invalidateOrderProducts([], undefined);
      // Assert — search pattern must still be cleared even if no items
      const patternCalls = cacheDelPattern.mock.calls.map(c => c[0]);
      expect(patternCalls).toContain('shopyos:products:search:*');
    });

    test('test_invalidateOrderProducts_called_resolves', async () => {
      // Arrange & Act & Assert
      await expect(
        invalidateOrderProducts([{ product_id: 'p99' }], 'store-99')
      ).resolves.toBeUndefined();
    });
  });
});
