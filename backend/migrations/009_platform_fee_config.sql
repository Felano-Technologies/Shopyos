-- Central fee configuration table
-- Each row is a named config parameter with typed value
CREATE TABLE IF NOT EXISTS platform_fee_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key      VARCHAR(100) UNIQUE NOT NULL,
    config_value    NUMERIC(12,4) NOT NULL,
    config_type     VARCHAR(30) NOT NULL DEFAULT 'percentage',  -- 'percentage', 'fixed', 'multiplier', 'integer'
    category        VARCHAR(50) NOT NULL,  -- 'commission', 'delivery', 'advertising', 'payout', 'bargaining', 'buyer_protection'
    label           VARCHAR(255) NOT NULL,
    description     TEXT,
    min_value       NUMERIC(12,4),
    max_value       NUMERIC(12,4),
    updated_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Fee change audit log
CREATE TABLE IF NOT EXISTS fee_config_audit (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key      VARCHAR(100) NOT NULL,
    old_value       NUMERIC(12,4),
    new_value       NUMERIC(12,4) NOT NULL,
    changed_by      UUID NOT NULL REFERENCES users(id),
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_config_key      ON platform_fee_config(config_key);
CREATE INDEX IF NOT EXISTS idx_fee_config_category ON platform_fee_config(category);
CREATE INDEX IF NOT EXISTS idx_fee_audit_key       ON fee_config_audit(config_key, created_at DESC);

-- Seed all configurable parameters
INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value) VALUES
-- Commission
('platform_commission_rate',    10.00, 'percentage', 'commission', 'Platform Commission Rate', 'Percentage taken from each completed order', 0, 50),
('seller_payout_percentage',    90.00, 'percentage', 'commission', 'Seller Payout Percentage', 'Percentage of order amount paid to seller', 50, 100),

-- Delivery fees
('delivery_intra_min_fee',      15.00, 'fixed', 'delivery', 'Intra-Regional Min Delivery Fee', 'Minimum delivery fee for same-region orders', 0, 100),
('delivery_intra_max_fee',      30.00, 'fixed', 'delivery', 'Intra-Regional Max Delivery Fee', 'Maximum delivery fee cap for same-region orders', 0, 200),
('delivery_inter_min_fee',      40.00, 'fixed', 'delivery', 'Inter-Regional Min Delivery Fee', 'Minimum delivery fee for cross-region orders', 0, 200),
('delivery_default_base_fee',    5.00, 'fixed', 'delivery', 'Default Base Delivery Fee', 'Base fee when store has not set their own', 0, 50),
('driver_earnings_percentage',  85.00, 'percentage', 'delivery', 'Driver Earnings Percentage', 'Percentage of delivery fee earned by driver', 50, 100),

-- Parcel Partner (Inter-regional)
('parcel_partner_base_fee',     25.00, 'fixed', 'delivery', 'Parcel Partner Base Fee', 'Base transit fee for parcel partner service', 0, 200),
('last_mile_default_fee',       15.00, 'fixed', 'delivery', 'Last-Mile Default Fee', 'Default fee for final delivery from hub to buyer', 0, 100),

-- Advertising
('min_ad_budget',                5.00, 'fixed', 'advertising', 'Minimum Ad Budget', 'Minimum spend for product promotions', 1, 100),
('ad_cost_per_impression',       0.02, 'fixed', 'advertising', 'Cost Per Impression', 'Amount charged per ad impression', 0, 1),
('ad_cost_per_click',            0.10, 'fixed', 'advertising', 'Cost Per Click', 'Amount charged per ad click', 0, 5),
('banner_campaign_daily_fee',   10.00, 'fixed', 'advertising', 'Banner Campaign Daily Fee', 'Daily fee for banner ad placement', 0, 500),
('banner_campaign_weekly_fee',  50.00, 'fixed', 'advertising', 'Banner Campaign Weekly Fee', 'Weekly fee for banner ad placement', 0, 2000),
('banner_campaign_monthly_fee',150.00, 'fixed', 'advertising', 'Banner Campaign Monthly Fee', 'Monthly fee for banner ad placement', 0, 5000),

-- Payouts
('min_payout_amount',           50.00, 'fixed', 'payout', 'Minimum Payout Amount', 'Minimum balance required to request payout', 1, 500),
('payout_processing_days',      5.00, 'integer', 'payout', 'Payout Processing Days', 'Number of business days to process payouts', 1, 30),

-- Buyer Protection
('buyer_protection_fee',         2.00, 'fixed', 'buyer_protection', 'Buyer Protection Fee', 'Fee charged to buyer for purchase protection (₵ per order)', 0, 50),
('buyer_protection_enabled',     1.00, 'integer', 'buyer_protection', 'Enable Buyer Protection', '1 = enabled, 0 = disabled', 0, 1),

-- Bargaining
('bargain_max_rounds',           3.00, 'integer', 'bargaining', 'Max Bargain Rounds', 'Maximum counter-offer rounds per session', 1, 10),
('bargain_offer_ttl_hours',     24.00, 'integer', 'bargaining', 'Offer TTL (Hours)', 'Hours before an unanswered offer expires', 1, 168),
('bargain_checkout_window_hours', 1.00, 'integer', 'bargaining', 'Checkout Window (Hours)', 'Hours buyer has to checkout after offer accepted', 0.5, 24),

-- Flash Sales
('flash_sale_max_duration_hours', 72.00, 'integer', 'flash_sale', 'Max Flash Sale Duration', 'Maximum hours a flash sale can run', 1, 168),
('flash_sale_min_discount_pct',  10.00, 'percentage', 'flash_sale', 'Min Discount Percentage', 'Minimum discount required for flash sale', 5, 90),
('flash_sale_max_concurrent',    10.00, 'integer', 'flash_sale', 'Max Concurrent Flash Sales', 'Maximum flash sales displayed at once platform-wide', 1, 50)

ON CONFLICT (config_key) DO NOTHING;
