INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value) VALUES
('listing_free_product_limit',  10.00, 'integer', 'payout', 'Free Listing Product Limit', 'Max free products before listing fee required', 1, 1000),
('listing_fee_amount',          50.00, 'fixed',   'payout', 'Listing Fee Amount (GHS)', 'One-time fee to unlock unlimited listings', 1, 500)
ON CONFLICT (config_key) DO NOTHING;
