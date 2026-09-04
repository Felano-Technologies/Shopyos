-- Migration 042: Minimum discount required for a product to appear on the
-- buyer-facing Deals screen (via a real seller-set compare_at_price).

INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value) VALUES
('deals_min_discount_pct', 10.00, 'percentage', 'deals', 'Deals Min Discount Percentage', 'Minimum discount required for a product to appear on the Deals screen', 1, 90)
ON CONFLICT (config_key) DO NOTHING;
