-- =====================================================
-- Migration 024: Add Verification Docs to Stores
-- =====================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_cert_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tax_id VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_license_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS proof_of_bank_url TEXT;
