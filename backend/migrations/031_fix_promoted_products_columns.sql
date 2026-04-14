-- Migration 031: Fix Promoted Products Column Mismatch
-- =====================================================
-- The promoted_products table was originally created with:
--   budget_allocated, budget_spent, is_active, total_impressions, total_clicks
--
-- However, the PromotedProductRepository queries for:
--   budget, spent_amount, status, impressions, clicks
--
-- This migration adds the missing columns (with defaults derived from existing data)
-- and updates the RPC functions to reference the correct column names.
-- =====================================================

-- Ensure legacy columns exist so references below do not fail on drifted schemas.
ALTER TABLE promoted_products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS budget_allocated DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_spent DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_impressions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_click DECIMAL(10, 2) DEFAULT 0.10;

-- 1. Add 'status' column (TEXT) to replace the boolean 'is_active'
ALTER TABLE promoted_products
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Back-fill status from existing is_active flag
UPDATE promoted_products
  SET status = CASE WHEN is_active = TRUE THEN 'active' ELSE 'paused' END
  WHERE status = 'active'; -- only touch rows not yet explicitly set

-- 2. Add 'budget' as an alias for 'budget_allocated'
ALTER TABLE promoted_products
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2);

UPDATE promoted_products
  SET budget = budget_allocated
  WHERE budget IS NULL;

ALTER TABLE promoted_products
  ALTER COLUMN budget SET NOT NULL,
  ALTER COLUMN budget SET DEFAULT 0;

-- 3. Add 'spent_amount' as an alias for 'budget_spent'
ALTER TABLE promoted_products
  ADD COLUMN IF NOT EXISTS spent_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE promoted_products
  SET spent_amount = budget_spent
  WHERE spent_amount = 0 AND budget_spent > 0;

-- 4. Add 'impressions' as an alias for 'total_impressions'
ALTER TABLE promoted_products
  ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0;

UPDATE promoted_products
  SET impressions = total_impressions
  WHERE impressions = 0 AND total_impressions > 0;

-- 5. Add 'clicks' as an alias for 'total_clicks'
ALTER TABLE promoted_products
  ADD COLUMN IF NOT EXISTS clicks INTEGER NOT NULL DEFAULT 0;

UPDATE promoted_products
  SET clicks = total_clicks
  WHERE clicks = 0 AND total_clicks > 0;

-- 6. Add index on status for query performance
CREATE INDEX IF NOT EXISTS idx_promoted_products_status
  ON promoted_products(status, start_date, end_date)
  WHERE status = 'active';

-- 7. Update the record_promotion_impression RPC to use the new column names
CREATE OR REPLACE FUNCTION record_promotion_impression(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_cost NUMERIC := 0.01;
  v_new_spent NUMERIC;
  v_budget NUMERIC;
BEGIN
  UPDATE promoted_products
  SET
    impressions      = impressions + 1,
    total_impressions = total_impressions + 1,
    spent_amount     = spent_amount + v_cost,
    budget_spent     = budget_spent + v_cost,
    updated_at       = NOW()
  WHERE id = p_campaign_id
  RETURNING spent_amount, budget INTO v_new_spent, v_budget;

  -- Pause if budget is exhausted
  IF v_new_spent >= v_budget THEN
    UPDATE promoted_products
    SET status    = 'paused',
        is_active = FALSE
    WHERE id = p_campaign_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 8. Update the record_promotion_click RPC to use the new column names
CREATE OR REPLACE FUNCTION record_promotion_click(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_cost NUMERIC;
  v_new_spent NUMERIC;
  v_budget NUMERIC;
BEGIN
  SELECT cost_per_click INTO v_cost
  FROM promoted_products
  WHERE id = p_campaign_id;

  UPDATE promoted_products
  SET
    clicks       = clicks + 1,
    total_clicks = total_clicks + 1,
    spent_amount = spent_amount + COALESCE(v_cost, 0.10),
    budget_spent = budget_spent + COALESCE(v_cost, 0.10),
    updated_at   = NOW()
  WHERE id = p_campaign_id
  RETURNING spent_amount, budget INTO v_new_spent, v_budget;

  -- Pause if budget is exhausted
  IF v_new_spent >= v_budget THEN
    UPDATE promoted_products
    SET status    = 'paused',
        is_active = FALSE
    WHERE id = p_campaign_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
