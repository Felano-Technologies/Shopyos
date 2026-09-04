-- Last-mile (destination hub → buyer) delivery was previously a flat fee
-- regardless of actual distance. Add a per-km rate so it scales the same
-- way the store→hub leg already does; last_mile_default_fee becomes the
-- base fee (effectively the floor at distance ~0) instead of a fixed total.
INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value) VALUES
('last_mile_per_km_fee', 2.00, 'fixed', 'delivery', 'Last-Mile Per-KM Fee', 'Per-km rate for the final delivery leg from hub to buyer', 0, 20)

ON CONFLICT (config_key) DO NOTHING;
