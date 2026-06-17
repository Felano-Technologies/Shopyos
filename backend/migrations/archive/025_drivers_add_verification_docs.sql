-- =====================================================
-- Migration 025: Add Verification Docs to Drivers
-- =====================================================
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS insurance_doc_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS national_id_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS vehicle_reg_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS roadworthy_url TEXT;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
