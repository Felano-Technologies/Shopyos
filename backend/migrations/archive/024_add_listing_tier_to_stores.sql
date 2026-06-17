-- 024_add_listing_tier_to_stores.sql
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS listing_tier VARCHAR(20) DEFAULT 'free',  -- 'free', 'paid'
  ADD COLUMN IF NOT EXISTS listing_fee_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_fee_reference VARCHAR(100);
