-- Migration 057: Post-approval shop location change requests (Phase 2).
-- An already-approved seller cannot silently edit their verified location —
-- a change goes through a lightweight review of its own while the seller's
-- current verified location/operations continue uninterrupted meanwhile.
-- Documents for a change (if ever required) attach via the existing
-- verification_documents table with parent_type='shop_location_change'.

CREATE TABLE IF NOT EXISTS shop_location_changes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id),
  new_address_line1 TEXT,
  new_city         VARCHAR(80),
  new_region       VARCHAR(80),
  new_latitude     NUMERIC,
  new_longitude    NUMERIC,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES users(id),
  rejection_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_shoplocchange_store ON shop_location_changes(store_id);
