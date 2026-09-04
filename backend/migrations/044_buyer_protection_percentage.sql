-- Switch buyer protection from a flat fee to a percentage of the order
-- subtotal, clamped between a minimum and maximum, so it scales fairly
-- across cheap and expensive/fragile items alike.
DELETE FROM platform_fee_config WHERE config_key = 'buyer_protection_fee';

INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value) VALUES
('buyer_protection_pct', 1.50, 'percentage', 'buyer_protection', 'Buyer Protection Rate', 'Percentage of order subtotal charged for purchase protection', 0, 10),
('buyer_protection_min', 2.00, 'fixed', 'buyer_protection', 'Buyer Protection Min Fee', 'Minimum buyer protection fee (₵), applied when the percentage would be lower', 0, 20),
('buyer_protection_max', 15.00, 'fixed', 'buyer_protection', 'Buyer Protection Max Fee', 'Maximum buyer protection fee (₵) cap, applied when the percentage would be higher', 0, 200)

ON CONFLICT (config_key) DO NOTHING;
