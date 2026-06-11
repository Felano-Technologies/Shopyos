// db/repositories/RecommendationRepository.js
// Read-only data access for recommendation queries.
// Uses raw SQL (getPool) for complex joins not supported by the QueryBuilder.

const { getPool } = require('../../config/postgres');

// ─── SQL constants ────────────────────────────────────────────────────────────

const SIMILAR_PRODUCTS_SQL = `
  SELECT
    p.id,
    p.title              AS name,
    p.price,
    p.compare_at_price,
    p.category,
    p.brand,
    p.average_rating,
    p.total_sales,
    (SELECT image_url FROM product_images
     WHERE product_id = p.id
     ORDER BY display_order ASC, is_primary DESC
     LIMIT 1)            AS image_url,
    COALESCE(ps.score * 2, 0)
      + CASE WHEN p.category = ref.category THEN 3 ELSE 0 END
      + CASE WHEN p.brand IS NOT NULL AND p.brand = ref.brand THEN 2 ELSE 0 END
      + CASE WHEN ref.price > 0
               AND ABS(p.price - ref.price) / ref.price <= 0.30 THEN 1 ELSE 0 END
      + CASE WHEN p.average_rating >= 4.0 THEN 1 ELSE 0 END
      AS score
  FROM products p
  CROSS JOIN (
    SELECT category, brand, price
    FROM products
    WHERE id = $1 AND deleted_at IS NULL
  ) ref
  LEFT JOIN product_similarities ps
    ON ps.product_id = $1 AND ps.similar_product_id = p.id
  WHERE p.id != $1
    AND p.is_active = true
    AND p.is_in_stock = true
    AND p.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM stores WHERE id = p.store_id AND is_verified = true)
  ORDER BY score DESC
  LIMIT $2
`;

const PERSONALIZED_SQL = `
  WITH user_categories AS (
    SELECT p.category, COUNT(*) AS weight
    FROM user_events ue
    JOIN products p ON p.id = ue.product_id
    WHERE ue.user_id = $1
    GROUP BY p.category
    ORDER BY weight DESC
    LIMIT 3
  ),
  seen AS (
    SELECT DISTINCT product_id FROM user_events WHERE user_id = $1
    UNION
    SELECT DISTINCT oi.product_id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.buyer_id = $1
  )
  SELECT
    p.id,
    p.title              AS name,
    p.price,
    p.compare_at_price,
    p.category,
    p.brand,
    p.average_rating,
    p.total_sales,
    (SELECT image_url FROM product_images
     WHERE product_id = p.id
     ORDER BY display_order ASC, is_primary DESC
     LIMIT 1)            AS image_url
  FROM products p
  JOIN user_categories uc ON uc.category = p.category
  WHERE p.is_active = true
    AND p.is_in_stock = true
    AND p.deleted_at IS NULL
    AND p.id NOT IN (SELECT product_id FROM seen)
    AND EXISTS (SELECT 1 FROM stores WHERE id = p.store_id AND is_verified = true)
  ORDER BY p.average_rating DESC, p.total_sales DESC
  LIMIT $2
`;

const TRENDING_SQL = `
  SELECT
    p.id,
    p.title              AS name,
    p.price,
    p.compare_at_price,
    p.category,
    p.brand,
    p.average_rating,
    p.total_sales,
    (SELECT image_url FROM product_images
     WHERE product_id = p.id
     ORDER BY display_order ASC, is_primary DESC
     LIMIT 1)            AS image_url
  FROM products p
  WHERE p.is_active = true
    AND p.is_in_stock = true
    AND p.deleted_at IS NULL
    AND ($1::text IS NULL OR p.category = $1)
    AND EXISTS (SELECT 1 FROM stores WHERE id = p.store_id AND is_verified = true)
  ORDER BY p.total_sales DESC, p.average_rating DESC
  LIMIT $2
`;

const CO_PURCHASE_SQL = `
  SELECT
    oi1.product_id,
    oi2.product_id                       AS similar_product_id,
    COUNT(DISTINCT oi1.order_id)::float  AS score
  FROM order_items oi1
  JOIN order_items oi2
    ON  oi1.order_id = oi2.order_id
    AND oi1.product_id::text < oi2.product_id::text
  GROUP BY oi1.product_id, oi2.product_id
`;

// ─── Repository class ─────────────────────────────────────────────────────────

class RecommendationRepository {
  async getSimilarProducts(productId, limit) {
    const db = getPool();
    const { rows } = await db.query(SIMILAR_PRODUCTS_SQL, [productId, limit]);
    return rows;
  }

  async getPersonalizedForUser(userId, limit) {
    const db = getPool();
    const { rows } = await db.query(PERSONALIZED_SQL, [userId, limit]);
    return rows;
  }

  async getTrending(category, limit) {
    const db = getPool();
    const { rows } = await db.query(TRENDING_SQL, [category || null, limit]);
    return rows;
  }

  async computeCoPurchaseScores() {
    const db = getPool();
    const { rows } = await db.query(CO_PURCHASE_SQL);
    return rows;
  }

  async batchUpsertSimilarities(pairs) {
    if (!pairs.length) return;
    const db = getPool();
    const productIds   = pairs.map(p => p.product_id);
    const similarIds   = pairs.map(p => p.similar_product_id);
    const scores       = pairs.map(p => p.score);
    await db.query(`
      INSERT INTO product_similarities
        (product_id, similar_product_id, score, last_computed_at)
      SELECT unnest($1::uuid[]), unnest($2::uuid[]), unnest($3::float[]), NOW()
      ON CONFLICT (product_id, similar_product_id)
      DO UPDATE SET score = EXCLUDED.score, last_computed_at = NOW()
    `, [productIds, similarIds, scores]);
  }
}

module.exports = RecommendationRepository;
