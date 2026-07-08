-- Migration 028: Engagement notification features
--   1. Price-drop / back-in-stock alert state on favorites
--   2. Daily check-in streaks (loyalty points reward)
--   3. Flash sale announcement tracking + new notification types

-- ── 1. Favorites alert state ──────────────────────────────────────────────────
-- alert_price / alert_in_stock hold the last state the user was notified against.
-- Initialized by the sweep on first pass, then compared on every subsequent pass.
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS alert_price       DECIMAL(10, 2);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS alert_in_stock    BOOLEAN;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS price_notified_at TIMESTAMPTZ;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS stock_notified_at TIMESTAMPTZ;

-- ── 2. Daily check-ins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_checkins (
    user_id        UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date   DATE    NOT NULL,
    streak         INTEGER NOT NULL DEFAULT 1,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user ON daily_checkins(user_id, checkin_date DESC);

-- ── 3. Flash sale announcements ───────────────────────────────────────────────
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS start_announced_at  TIMESTAMPTZ;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS ending_announced_at TIMESTAMPTZ;

-- New notification types (wrapped so re-runs are safe)
DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'flash_sale_started';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'flash_sale_ending';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
