-- Migration 049: Loyalty / points system
-- loyalty_points  — one row per user, holds the live balance.
-- loyalty_transactions — full ledger of every earn/redeem event.

CREATE TABLE IF NOT EXISTS loyalty_points (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance          INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned  INTEGER     NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'admin_adjustment')),
  points      INTEGER     NOT NULL,  -- positive = credit, negative = debit
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user
  ON loyalty_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user
  ON loyalty_points (user_id);
