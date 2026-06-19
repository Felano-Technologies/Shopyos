-- Migration 053: Scheduled / slot-based delivery
-- delivery_slots defines the available time windows (per-store or platform-wide).
-- orders gets columns to record a buyer's chosen slot.

CREATE TABLE IF NOT EXISTS delivery_slots (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID     REFERENCES stores(id) ON DELETE CASCADE, -- NULL = platform-wide
  day_of_week  INTEGER  CHECK (day_of_week BETWEEN 0 AND 6),     -- 0=Sun … 6=Sat
  slot_start   TIME     NOT NULL,
  slot_end     TIME     NOT NULL,
  max_orders   INTEGER  NOT NULL DEFAULT 20,
  is_active    BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_delivery_slots_store
  ON delivery_slots (store_id, day_of_week)
  WHERE is_active = TRUE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS scheduled_delivery_date     DATE,
  ADD COLUMN IF NOT EXISTS scheduled_delivery_slot_id  UUID REFERENCES delivery_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_delivery_label    TEXT; -- human-readable e.g. "Tomorrow, 2–4 PM"
