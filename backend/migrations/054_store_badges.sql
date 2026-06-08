-- Migration 054: Seller badges & trust signals
-- A nightly cron job in scheduler.js evaluates each store against metric
-- thresholds and upserts badges here. The frontend displays them as chips.

CREATE TABLE IF NOT EXISTS store_badges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  badge_key   TEXT        NOT NULL,  -- 'top_seller' | 'fast_responder' | 'verified' | 'hundred_orders'
  badge_label TEXT        NOT NULL,  -- display text e.g. "Top Seller"
  awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_store_badges_store
  ON store_badges (store_id);
