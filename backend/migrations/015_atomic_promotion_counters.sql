-- Migration 015: Atomic Promotion Counters
-- Uses RPC to prevent race conditions during impression/click tracking

CREATE OR REPLACE FUNCTION record_promotion_impression(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_cost NUMERIC := 0.01;
  v_new_spent NUMERIC;
  v_budget NUMERIC;
BEGIN
  -- Atomically increment and get new totals
  UPDATE promoted_products
  SET total_impressions = total_impressions + 1,
      budget_spent = budget_spent + v_cost,
      updated_at = NOW()
  WHERE id = p_campaign_id
  RETURNING budget_spent, budget_allocated INTO v_new_spent, v_budget;
  
  -- Pause if we hit budget limits
  IF v_new_spent >= v_budget THEN
    UPDATE promoted_products
    SET is_active = FALSE
    WHERE id = p_campaign_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_promotion_click(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_cost NUMERIC;
  v_new_spent NUMERIC;
  v_budget NUMERIC;
BEGIN
  -- Get cost_per_click first
  SELECT cost_per_click INTO v_cost FROM promoted_products WHERE id = p_campaign_id;

  -- Atomically increment and get new totals
  UPDATE promoted_products
  SET total_clicks = total_clicks + 1,
      budget_spent = budget_spent + COALESCE(v_cost, 0.10),
      updated_at = NOW()
  WHERE id = p_campaign_id
  RETURNING budget_spent, budget_allocated INTO v_new_spent, v_budget;
  
  -- Pause if we hit budget limits
  IF v_new_spent >= v_budget THEN
    UPDATE promoted_products
    SET is_active = FALSE
    WHERE id = p_campaign_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
