-- =====================================================
-- Migration 029: Add Payout Method to Stores
-- =====================================================

ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20) DEFAULT 'bank' 
CHECK (payout_method IN ('bank', 'momo'));
