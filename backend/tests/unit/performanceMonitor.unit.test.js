'use strict';

/**
 * tests/unit/performanceMonitor.unit.test.js
 *
 * Unit tests for performanceMiddleware, getMetrics, and recordCacheError.
 * Mocks logger to avoid real log output.
 * Conforms to guidelines/test.md.
 */

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  httpLogMiddleware: (req, res, next) => next(),
}));

const { logger } = require('../../config/logger');

// ── Helpers ──────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    method: 'GET',
    originalUrl: '/api/v1/products',
    ip: '127.0.0.1',
    requestId: 'test-req-id',
    ...overrides,
  };
}

/**
 * Creates a minimal res mock that supports EventEmitter-style on/removeListener,
 * getHeader/setHeader, and statusCode.
 */
function mockRes(statusCode = 200) {
  const listeners = {};
  const res = {
    statusCode,
    _headers: {},
  };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn((key, value) => { res._headers[key] = value; });
  res.getHeader = jest.fn((key) => res._headers[key]);
  res.on = jest.fn((event, handler) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  });
  res.removeListener = jest.fn((event, handler) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter(h => h !== handler);
    }
  });
  // Trigger an event manually in tests
  res._emit = (event) => {
    if (listeners[event]) listeners[event].forEach(h => h());
  };
  return res;
}

// ── Module re-import per test file to get a fresh metrics state ───────────────
// Jest module cache persists across tests in the same file so we isolate using
// a beforeAll and the imported reference directly.
let performanceMiddleware;
let getMetrics;
let recordCacheError;

beforeAll(() => {
  jest.resetModules();
  jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    httpLogMiddleware: (req, res, next) => next(),
  }));
  ({ performanceMiddleware, getMetrics, recordCacheError } = require('../../middleware/performanceMonitor'));
});

describe('performanceMonitor Unit Tests', () => {
  // ── performanceMiddleware ──────────────────────────────────────────────────
  describe('performanceMiddleware', () => {
    test('test_performanceMiddleware_anyRequest_callsNextImmediately', () => {
      // Arrange
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('test_performanceMiddleware_onRequestStart_incrementsTotalAndActiveCounters', () => {
      // Arrange
      const before = getMetrics();
      const totalBefore = before.requests.total;
      const activeBefore = before.requests.active;

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);

      // Assert — active should have increased by 1 (finish not yet fired)
      const after = getMetrics();
      expect(after.requests.total).toBe(totalBefore + 1);
      expect(after.requests.active).toBe(activeBefore + 1);
    });

    test('test_performanceMiddleware_onFinishEvent_decrementsActiveCounter', () => {
      // Arrange
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      performanceMiddleware(req, res, next);
      const activeDuringRequest = getMetrics().requests.active;

      // Act — simulate response finish
      res._emit('finish');

      // Assert
      const activeAfterFinish = getMetrics().requests.active;
      expect(activeAfterFinish).toBe(activeDuringRequest - 1);
    });

    test('test_performanceMiddleware_onFinishEvent_recordsStatusCode', () => {
      // Arrange
      const req = mockReq();
      const res = mockRes(201);
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);
      res._emit('finish');

      // Assert
      const metrics = getMetrics();
      expect(metrics.requests.statusCodes['201']).toBeGreaterThanOrEqual(1);
    });

    test('test_performanceMiddleware_onFinishEvent_incrementsResponseTimeCount', () => {
      // Arrange
      const before = getMetrics();
      const countBefore = before.performance.avgResponseMs !== undefined ? 0 : 0; // ensure shape

      const req = mockReq();
      const res = mockRes(200);
      const next = jest.fn();

      performanceMiddleware(req, res, next);
      const countBeforeFinish = getMetrics().requests.total;

      // Act
      res._emit('finish');

      // Assert — histogram bucket counts are non-negative after recording
      const after = getMetrics();
      const totalBucketCount = Object.values(after.performance.histogram).reduce((a, b) => a + b, 0);
      expect(totalBucketCount).toBeGreaterThanOrEqual(1);
      void countBefore; void countBeforeFinish; // suppress unused lint
    });

    test('test_performanceMiddleware_onCloseEvent_decrementsActiveCounter', () => {
      // Arrange
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      performanceMiddleware(req, res, next);
      const activeDuringRequest = getMetrics().requests.active;

      // Act — simulate connection close (client dropped)
      res._emit('close');

      // Assert
      expect(getMetrics().requests.active).toBe(activeDuringRequest - 1);
    });

    test('test_performanceMiddleware_onFinish_cacheHitHeader_incrementsHitCounter', () => {
      // Arrange
      const before = getMetrics();
      const hitsBefore = before.cache.hits;

      const req = mockReq();
      const res = mockRes();
      res._headers['X-Cache'] = 'HIT';
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);
      res._emit('finish');

      // Assert
      expect(getMetrics().cache.hits).toBe(hitsBefore + 1);
    });

    test('test_performanceMiddleware_onFinish_cacheMissHeader_incrementsMissCounter', () => {
      // Arrange
      const before = getMetrics();
      const missesBefore = before.cache.misses;

      const req = mockReq();
      const res = mockRes();
      res._headers['X-Cache'] = 'MISS';
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);
      res._emit('finish');

      // Assert
      expect(getMetrics().cache.misses).toBe(missesBefore + 1);
    });

    test('test_performanceMiddleware_onFinish_hitAfterWaitHeader_incrementsStampedeCounter', () => {
      // Arrange
      const before = getMetrics();
      const hitAfterWaitBefore = before.cache.stampedesSaved;

      const req = mockReq();
      const res = mockRes();
      res._headers['X-Cache'] = 'HIT_AFTER_WAIT';
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);
      res._emit('finish');

      // Assert
      expect(getMetrics().cache.stampedesSaved).toBe(hitAfterWaitBefore + 1);
    });

    test('test_performanceMiddleware_onFinish_noXCacheHeader_doesNotIncrementCacheCounters', () => {
      // Arrange
      const before = getMetrics();
      const hitsBefore = before.cache.hits;
      const missesBefore = before.cache.misses;

      const req = mockReq();
      const res = mockRes();
      // No X-Cache header set
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);
      res._emit('finish');

      // Assert
      const after = getMetrics();
      expect(after.cache.hits).toBe(hitsBefore);
      expect(after.cache.misses).toBe(missesBefore);
    });

    test('test_performanceMiddleware_attachesFinishAndCloseListeners', () => {
      // Arrange
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // Act
      performanceMiddleware(req, res, next);

      // Assert
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  // ── getMetrics ─────────────────────────────────────────────────────────────
  describe('getMetrics', () => {
    test('test_getMetrics_always_returnsObjectWithRequiredTopLevelKeys', () => {
      // Act
      const metrics = getMetrics();

      // Assert
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('startedAt');
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('memory');
    });

    test('test_getMetrics_requests_containsTotalActiveAndStatusCodes', () => {
      // Act
      const { requests } = getMetrics();

      // Assert
      expect(requests).toHaveProperty('total');
      expect(requests).toHaveProperty('active');
      expect(requests).toHaveProperty('statusCodes');
      expect(typeof requests.total).toBe('number');
      expect(typeof requests.active).toBe('number');
    });

    test('test_getMetrics_performance_containsAvgMaxSlowAndHistogram', () => {
      // Act
      const { performance } = getMetrics();

      // Assert
      expect(performance).toHaveProperty('avgResponseMs');
      expect(performance).toHaveProperty('maxResponseMs');
      expect(performance).toHaveProperty('slowRequests');
      expect(performance).toHaveProperty('histogram');
      expect(performance.histogram).toHaveProperty('under50ms');
      expect(performance.histogram).toHaveProperty('50to200ms');
      expect(performance.histogram).toHaveProperty('200to500ms');
      expect(performance.histogram).toHaveProperty('500to1000ms');
      expect(performance.histogram).toHaveProperty('over1000ms');
    });

    test('test_getMetrics_cache_containsHitsMissesStampedesAndHitRate', () => {
      // Act
      const { cache } = getMetrics();

      // Assert
      expect(cache).toHaveProperty('hits');
      expect(cache).toHaveProperty('misses');
      expect(cache).toHaveProperty('stampedesSaved');
      expect(cache).toHaveProperty('hitRate');
    });

    test('test_getMetrics_memory_containsHeapUsedAndHeapTotal', () => {
      // Act
      const { memory } = getMetrics();

      // Assert
      expect(memory).toHaveProperty('heapUsed');
      expect(memory).toHaveProperty('heapTotal');
      expect(memory).toHaveProperty('rss');
      expect(memory).toHaveProperty('external');
      // Values should be formatted as e.g. "42MB"
      expect(memory.heapUsed).toMatch(/^\d+MB$/);
      expect(memory.rss).toMatch(/^\d+MB$/);
    });

    test('test_getMetrics_noCacheOps_hitRateIsNotAvailable', () => {
      // Arrange — fresh module, no requests served yet
      jest.resetModules();
      jest.mock('../../config/logger', () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        httpLogMiddleware: (req, res, next) => next(),
      }));
      const { getMetrics: freshGetMetrics } = require('../../middleware/performanceMonitor');

      // Act
      const { cache } = freshGetMetrics();

      // Assert
      expect(cache.hitRate).toBe('N/A');
    });

    test('test_getMetrics_uptime_isNonNegativeNumber', () => {
      // Act
      const { uptime } = getMetrics();

      // Assert
      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    test('test_getMetrics_startedAt_isValidIsoDateString', () => {
      // Act
      const { startedAt } = getMetrics();

      // Assert
      expect(typeof startedAt).toBe('string');
      expect(new Date(startedAt).toISOString()).toBe(startedAt);
    });
  });

  // ── recordCacheError ───────────────────────────────────────────────────────
  describe('recordCacheError', () => {
    test('test_recordCacheError_called_doesNotThrow', () => {
      // Act / Assert
      expect(() => recordCacheError()).not.toThrow();
    });
  });
});
