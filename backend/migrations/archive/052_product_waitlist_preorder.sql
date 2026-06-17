-- Migration 052: Pre-orders and back-in-stock waitlist
-- Adds pre-order flag to products and a waitlist table so users can be
-- notified when an out-of-stock or upcoming product becomes available.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_preorder             BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_available_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS product_waitlist (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_waitlist_product
  ON product_waitlist (product_id)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_waitlist_user
  ON product_waitlist (user_id);
