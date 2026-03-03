-- =====================================================
-- Migration 023: Add Missing Verification Columns to Stores
-- =====================================================
-- Note: verification_status (varchar) and is_verified (boolean) already exist
-- in the live DB. This migration adds the columns the AdminRepository
-- references in updateStoreVerification() that may not yet exist.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Add index for fast admin queries on verification status
CREATE INDEX IF NOT EXISTS idx_stores_verification_status ON stores(verification_status);

-- Ensure existing stores without a verification_status get defaulted to 'pending'
UPDATE stores SET verification_status = 'pending' WHERE verification_status IS NULL;
