-- 047_buyer_protection_flat_percentage.sql
-- Buyer protection is now a flat percentage of the order subtotal, with no
-- floor/ceiling clamp (previously clamped between buyer_protection_min and
-- buyer_protection_max, which distorted the fee for cheap/expensive orders —
-- e.g. a ₵50 order at 2.5% should charge ₵1.25, not get bumped up to a
-- minimum). Update the rate and drop the now-unused min/max config rows.

UPDATE platform_fee_config
SET config_value = 2.50
WHERE config_key = 'buyer_protection_pct';

DELETE FROM platform_fee_config
WHERE config_key IN ('buyer_protection_min', 'buyer_protection_max');
