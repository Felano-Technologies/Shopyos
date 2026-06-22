-- 019_delivery_fee_scaling.sql
-- Introduces a platform-level per-km default so delivery fees scale with distance
-- (Bolt model: fee = base + distance × per_km_rate, floor only, no ceiling).
-- Also lowers the intra-regional minimum from ₵15 to ₵10 so short trips
-- aren't over-charged now that distance is properly factored in.

-- Default per-km rate applied when a store has not configured delivery_per_km_fee
INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description)
VALUES (
    'delivery_default_per_km_fee',
    1.00,
    'fixed',
    'delivery',
    'Default Per-KM Delivery Fee',
    'Platform fallback per-km fee used when a store has not set their own delivery_per_km_fee. Applies to both intra-regional and the store-to-hub leg of inter-regional orders.'
)
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Lower the intra-regional minimum so short-distance orders pay a fair rate
UPDATE platform_fee_config
SET config_value = 10.00
WHERE config_key = 'delivery_intra_min_fee';
