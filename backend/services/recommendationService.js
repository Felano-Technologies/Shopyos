// services/recommendationService.js
// Orchestrates recommendation fetching: cache check → repository query → cache set.
// Falls back to trending if personalised/similar queries return no results.

const { cacheGet, cacheSet, cacheDelPattern } = require('../config/redis');
const { logger } = require('../config/logger');
const repositories = require('../db/repositories');

// ─── Constants ────────────────────────────────────────────────────────────────

const TTL = {
  similar:      3600,  // 1 hour
  personalized: 1800,  // 30 min
  trending:      900,  // 15 min
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampLimit(raw) {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

async function fetchWithCache(key, ttl, fetcher) {
  const cached = await cacheGet(key);
  if (cached) return cached;
  const result = await fetcher();
  await cacheSet(key, result, ttl);
  return result;
}

function cacheKey(type, id) {
  const map = {
    similar:      `shopyos:recommendations:product:${id}`,
    personalized: `shopyos:recommendations:user:${id}`,
    trending:     `shopyos:recommendations:trending:${id || 'all'}`,
  };
  return map[type];
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function getRecommendations(productId, userId, limit) {
  const n   = clampLimit(limit);
  const key = cacheKey('similar', productId);

  return fetchWithCache(key, TTL.similar, async () => {
    const products = await repositories.recommendations.getSimilarProducts(productId, n);
    if (products.length > 0) return { products, source: 'cf' };

    const fallback = await repositories.recommendations.getTrending(null, n);
    return { products: fallback, source: 'trending' };
  });
}

async function getPersonalized(userId, limit) {
  const n   = clampLimit(limit);
  const key = cacheKey('personalized', userId);

  return fetchWithCache(key, TTL.personalized, async () => {
    const products = await repositories.recommendations.getPersonalizedForUser(userId, n);
    if (products.length > 0) return { products, source: 'personalized' };

    const fallback = await repositories.recommendations.getTrending(null, n);
    return { products: fallback, source: 'trending' };
  });
}

async function getTrending(category, limit) {
  const n   = clampLimit(limit);
  const key = cacheKey('trending', category);

  return fetchWithCache(key, TTL.trending, async () => {
    const products = await repositories.recommendations.getTrending(category, n);
    return { products, source: 'trending' };
  });
}

async function computeAndStoreSimilarities() {
  logger.info('[Recommendations] Starting similarity recompute…');

  const pairs = await repositories.recommendations.computeCoPurchaseScores();
  if (!pairs.length) {
    logger.info('[Recommendations] No co-purchase data found — skipping upsert');
    return;
  }

  const bothDirections = pairs.flatMap(r => [
    { product_id: r.product_id,        similar_product_id: r.similar_product_id, score: r.score },
    { product_id: r.similar_product_id, similar_product_id: r.product_id,        score: r.score },
  ]);

  await repositories.recommendations.batchUpsertSimilarities(bothDirections);
  await cacheDelPattern('shopyos:recommendations:product:*');

  logger.info(`[Recommendations] Upserted ${bothDirections.length} similarity pairs ✓`);
}

module.exports = { getRecommendations, getPersonalized, getTrending, computeAndStoreSimilarities };
