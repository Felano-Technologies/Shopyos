-- =====================================================
-- Migration 027: Add is_trusted flag to Stores
-- =====================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT FALSE;

-- Create index for filtering trusted stores
CREATE INDEX IF NOT EXISTS idx_stores_is_trusted ON stores(is_trusted);

-- Comment for clarity
-- COMMENT ON COLUMN stores.is_trusted IS 'Whether the store has been identity-verified with official documents (green tick status)';
