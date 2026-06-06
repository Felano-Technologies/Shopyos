'use strict';

/**
 * tests/unit/cache.unit.test.js
 *
 * Unit tests for cache middleware, hashParams, and key generators.
 * Mocks Redis helpers.
 * Conforms to guidelines/test.md.
 */

// ── Mock Redis before requiring the module under test ───────────────────────
jest.mock('../../config/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(true),
  acquireLock: jest.fn().mockResolvedValue(true),
  releaseLock: jest.fn().mockResolvedValue(undefined),
}));

const {
  cacheMiddleware,
  hashParams,
  productCacheKey,
  categoryCacheKey,
  storeCacheKey,
  reviewCacheKey,
} = require('../../middleware/cache');
const { cacheGet, cacheSet, acquireLock, releaseLock } = require('../../config/redis');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    originalUrl: '/api/v1/test',
    requestId: 'test-req-id',
    params: {},
    query: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    _headers: {},
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn((key, value) => { res._headers[key] = value; });
  res.getHeader = jest.fn((key) => res._headers[key]);
  return res;
}

describe('Cache Middleware Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── hashParams ─────────────────────────────────────────────────────────────
  describe('hashParams', () => {
    test('test_hashParams_sameObjectDifferentKeyOrder_producesIdenticalHash', () => {
      // Arrange
      const paramsA = { b: 2, a: 1 };
      const paramsB = { a: 1, b: 2 };

      // Act
      const hashA = hashParams(paramsA);
      const hashB = hashParams(paramsB);

      // Assert
      expect(hashA).toBe(hashB);
    });

    test('test_hashParams_differentObjects_producesDifferentHashes', () => {
      // Arrange
      const paramsA = { page: 1, limit: 10 };
      const paramsB = { page: 2, limit: 10 };

      // Act
      const hashA = hashParams(paramsA);
      const hashB = hashParams(paramsB);

      // Assert
      expect(hashA).not.toBe(hashB);
    });

    test('test_hashParams_anyParams_returns12CharHexString', () => {
      // Arrange
      const params = { query: 'shoes', category: 'footwear' };

      // Act
      const hash = hashParams(params);

      // Assert
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(12);
      expect(hash).toMatch(/^[0-9a-f]{12}$/);
    });

    test('test_hashParams_emptyObject_returnsConsistentHash', () => {
      // Act
      const hash1 = hashParams({});
      const hash2 = hashParams({});

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(12);
    });
  });

  // ── cacheMiddleware — cache hit ────────────────────────────────────────────
  describe('cacheMiddleware — cache hit', () => {
    test('test_cacheMiddleware_cacheHit_returns200WithCachedDataAndHitHeader', async () => {
      // Arrange
      const cachedData = { products: [{ id: 'p1' }], total: 1 };
      cacheGet.mockResolvedValueOnce(cachedData);
      const middleware = cacheMiddleware('shopyos:products:all');
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cachedData);
      expect(next).not.toHaveBeenCalled();
    });

    test('test_cacheMiddleware_cacheHit_doesNotCallCacheSet', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce({ data: 'cached' });
      const middleware = cacheMiddleware('some:key');
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Assert
      expect(cacheSet).not.toHaveBeenCalled();
    });
  });

  // ── cacheMiddleware — cache miss ───────────────────────────────────────────
  describe('cacheMiddleware — cache miss', () => {
    test('test_cacheMiddleware_cacheMiss_setsMissHeaderAndCallsNext', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      acquireLock.mockResolvedValueOnce(true);
      const middleware = cacheMiddleware('shopyos:products:all');
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Assert
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('test_cacheMiddleware_cacheMiss_interceptsResJsonToPopulateCache', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      acquireLock.mockResolvedValueOnce(true);
      const middleware = cacheMiddleware('shopyos:products:all', 120);
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Simulate the controller calling res.json()
      res.statusCode = 200;
      res.json({ items: [] });

      // Allow async cache write to settle
      await new Promise(r => setImmediate(r));

      // Assert
      expect(cacheSet).toHaveBeenCalledWith('shopyos:products:all', { items: [] }, 120);
    });

    test('test_cacheMiddleware_cacheMissNon2xxResponse_doesNotPopulateCache', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      acquireLock.mockResolvedValueOnce(true);
      const middleware = cacheMiddleware('shopyos:products:all');
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Simulate a 404 error response from the controller
      res.statusCode = 404;
      res.json({ error: 'Not found' });

      await new Promise(r => setImmediate(r));

      // Assert — cache should not be populated for error responses
      expect(cacheSet).not.toHaveBeenCalled();
    });
  });

  // ── cacheMiddleware — key generator function ───────────────────────────────
  describe('cacheMiddleware — key generator function', () => {
    test('test_cacheMiddleware_keyGeneratorFunction_invokesGeneratorWithRequest', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      acquireLock.mockResolvedValueOnce(true);
      const keyGen = jest.fn().mockReturnValue('dynamic:cache:key');
      const middleware = cacheMiddleware(keyGen);
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Assert
      expect(keyGen).toHaveBeenCalledWith(req);
      expect(cacheGet).toHaveBeenCalledWith('dynamic:cache:key');
    });

    test('test_cacheMiddleware_keyGeneratorReturnsNull_callsNextWithoutCacheLookup', async () => {
      // Arrange
      const keyGen = jest.fn().mockReturnValue(null);
      const middleware = cacheMiddleware(keyGen);
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Assert
      expect(cacheGet).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ── cacheMiddleware — Redis down (fail-open) ───────────────────────────────
  describe('cacheMiddleware — Redis error', () => {
    test('test_cacheMiddleware_cacheGetThrows_fallsThroughToNextWithMissHeader', async () => {
      // Arrange
      cacheGet.mockRejectedValueOnce(new Error('Redis connection refused'));
      acquireLock.mockResolvedValueOnce(true);
      const middleware = cacheMiddleware('shopyos:products:all');
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);

      // Assert — should fall through gracefully
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ── cacheMiddleware — default TTL ─────────────────────────────────────────
  describe('cacheMiddleware — default TTL', () => {
    test('test_cacheMiddleware_noTtlProvided_usesDefault300Seconds', async () => {
      // Arrange
      cacheGet.mockResolvedValueOnce(null);
      acquireLock.mockResolvedValueOnce(true);
      const middleware = cacheMiddleware('shopyos:test:key'); // no ttl argument
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      await middleware(req, res, next);
      res.statusCode = 200;
      res.json({ ok: true });

      await new Promise(r => setImmediate(r));

      // Assert
      expect(cacheSet).toHaveBeenCalledWith('shopyos:test:key', { ok: true }, 300);
    });
  });

  // ── Key generator helpers ──────────────────────────────────────────────────
  describe('productCacheKey', () => {
    test('test_productCacheKey_detail_includesProductIdInKey', () => {
      expect(productCacheKey.detail('prod-42')).toBe('shopyos:products:detail:prod-42');
    });

    test('test_productCacheKey_store_includesStoreIdPageAndLimitInKey', () => {
      expect(productCacheKey.store('store-1', 2, 20)).toBe('shopyos:products:store:store-1:2:20');
    });

    test('test_productCacheKey_search_includesHashedParamsInKey', () => {
      const key = productCacheKey.search({ q: 'shoes', page: 1 });
      expect(key).toMatch(/^shopyos:products:search:[0-9a-f]{12}$/);
    });

    test('test_productCacheKey_promoted_returnsStaticKey', () => {
      expect(productCacheKey.promoted()).toBe('shopyos:products:promoted');
    });
  });

  describe('categoryCacheKey', () => {
    test('test_categoryCacheKey_all_returnsStaticKey', () => {
      expect(categoryCacheKey.all()).toBe('shopyos:categories:all');
    });
  });

  describe('storeCacheKey', () => {
    test('test_storeCacheKey_detail_includesStoreIdInKey', () => {
      expect(storeCacheKey.detail('store-99')).toBe('shopyos:stores:detail:store-99');
    });

    test('test_storeCacheKey_all_includesHashedParamsInKey', () => {
      const key = storeCacheKey.all({ page: 1, limit: 10 });
      expect(key).toMatch(/^shopyos:stores:all:[0-9a-f]{12}$/);
    });

    test('test_storeCacheKey_featured_returnsStaticKey', () => {
      expect(storeCacheKey.featured()).toBe('shopyos:stores:featured');
    });
  });

  describe('reviewCacheKey', () => {
    test('test_reviewCacheKey_product_includesProductIdAndPageInKey', () => {
      expect(reviewCacheKey.product('prod-1', 3)).toBe('shopyos:reviews:product:prod-1:3');
    });

    test('test_reviewCacheKey_store_includesStoreIdAndPageInKey', () => {
      expect(reviewCacheKey.store('store-2', 1)).toBe('shopyos:reviews:store:store-2:1');
    });
  });
});
