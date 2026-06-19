-- Migration: Add seller-configurable delivery fee columns to stores
-- Sellers set a base fee + optional per-km rate.
-- delivery_fee = base_fee + (distance_km * per_km_fee)

ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS delivery_base_fee  NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_per_km_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_max_km     NUMERIC(10,2) DEFAULT NULL; -- NULL = no limit

COMMENT ON COLUMN stores.delivery_base_fee   IS 'Flat delivery fee charged per order regardless of distance (₵)';
COMMENT ON COLUMN stores.delivery_per_km_fee IS 'Additional fee per km of straight-line distance (₵/km)';
COMMENT ON COLUMN stores.delivery_max_km     IS 'Max delivery radius in km. NULL means seller delivers anywhere.';
