-- Migration 048: Abandoned cart recovery
-- Adds last_activity and abandonment_notified_at to carts so the scheduler
-- can detect inactive carts and send a one-time recovery push notification.

ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS abandonment_notified_at TIMESTAMPTZ;

-- Index used by the scheduler's 15-minute sweep:
--   WHERE last_activity < NOW() - INTERVAL '1 hour'
--   AND   abandonment_notified_at IS NULL
CREATE INDEX IF NOT EXISTS idx_carts_abandonment_sweep
  ON carts (last_activity)
  WHERE abandonment_notified_at IS NULL;
