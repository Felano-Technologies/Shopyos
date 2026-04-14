-- =====================================================
-- Migration 023: Add Missing Verification Columns to Stores
-- =====================================================
-- Note: is_verified exists in the base schema, but verification_status may be
-- missing in some environments. Keep this migration idempotent.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Backfill verification_status from existing verification fields when missing.
UPDATE stores
SET verification_status = CASE
	WHEN is_verified = TRUE THEN 'verified'
	WHEN rejection_reason IS NOT NULL THEN 'rejected'
	ELSE 'pending'
END
WHERE verification_status IS NULL;

-- Add index for fast admin queries on verification status
CREATE INDEX IF NOT EXISTS idx_stores_verification_status ON stores(verification_status);

-- Ensure existing stores without a verification_status get defaulted to 'pending'
UPDATE stores SET verification_status = 'pending' WHERE verification_status IS NULL;
