-- Migration 055: Promo codes + discount columns on orders

CREATE TABLE IF NOT EXISTS promo_codes (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50)   NOT NULL UNIQUE,
  type        TEXT          NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value       DECIMAL(10,2) NOT NULL CHECK (value > 0),
  min_order   DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_uses    INTEGER,                          -- NULL = unlimited
  uses_count  INTEGER       NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,                      -- NULL = never expires
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  store_id    UUID          REFERENCES stores(id) ON DELETE CASCADE, -- NULL = platform-wide
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_uses (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id   UUID        NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id  UUID        REFERENCES orders(id) ON DELETE SET NULL,
  used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, user_id)   -- one redemption per user per code
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code      ON promo_codes (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user  ON promo_code_uses (user_id);

-- Add discount tracking columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id        UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_points_used  INTEGER NOT NULL DEFAULT 0;
