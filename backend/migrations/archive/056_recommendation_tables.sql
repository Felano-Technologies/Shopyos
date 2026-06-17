-- 056: Add product_similarities table for pre-computed item-item CF scores

CREATE TABLE IF NOT EXISTS product_similarities (
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  similar_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  score              FLOAT NOT NULL DEFAULT 0,
  last_computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, similar_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_similarities_lookup
  ON product_similarities(product_id, score DESC);
