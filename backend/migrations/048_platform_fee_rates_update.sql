-- 048_platform_fee_rates_update.sql
-- Update payout percentages to match the new monetization model: Shopyos
-- keeps 5% of seller payouts, 2.5% of driver earnings, 2.5% of parcel-hub
-- earnings. The percentage-split mechanism already exists (confirm_delivery_atomic,
-- payHubTransitFee) — this just retargets the config values it reads.
UPDATE platform_fee_config SET config_value = 95.00  WHERE config_key = 'seller_payout_percentage';
UPDATE platform_fee_config SET config_value = 97.50  WHERE config_key = 'driver_earnings_percentage';
UPDATE platform_fee_config SET config_value = 97.50  WHERE config_key = 'hub_earnings_percentage';

-- The free/paid product-listing fee is retired — sellers no longer pay to
-- list products, only the transaction-based platform fees above apply.
-- Leaves stores.listing_tier/listing_fee_paid_at/listing_fee_reference columns
-- in place (historical data, harmless once unused) rather than a column drop.
DELETE FROM platform_fee_config WHERE config_key IN ('listing_free_product_limit', 'listing_fee_amount');
