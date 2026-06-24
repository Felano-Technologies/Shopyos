-- Extend return_requests with policy tracking fields
ALTER TABLE return_requests
    ADD COLUMN IF NOT EXISTS delivery_fee_at_time    DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS refundable_amount       DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS policy_version          VARCHAR(20) DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS disclaimer_acknowledged BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS acknowledged_at         TIMESTAMPTZ;

-- Disclaimer acknowledgements table (audit trail for all legal consent)
CREATE TABLE IF NOT EXISTS disclaimer_acknowledgements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    disclaimer_type VARCHAR(50) NOT NULL,
    version         VARCHAR(20) NOT NULL DEFAULT '1.0',
    context_id      UUID,
    context_type    VARCHAR(50),
    ip_address      INET,
    device_info     TEXT,
    acknowledged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disclaimer_ack_user ON disclaimer_acknowledgements(user_id, disclaimer_type);
CREATE INDEX IF NOT EXISTS idx_disclaimer_ack_context ON disclaimer_acknowledgements(context_id);

-- Platform disclaimers (versioned text)
CREATE TABLE IF NOT EXISTS platform_disclaimers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        VARCHAR(50) UNIQUE NOT NULL,
    version     VARCHAR(20) NOT NULL DEFAULT '1.0',
    title       VARCHAR(255) NOT NULL,
    content     TEXT NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default disclaimers
INSERT INTO platform_disclaimers (type, version, title, content) VALUES
('refund_policy', '1.0', 'Refund & Cancellation Policy', 'By proceeding with this payment, you agree to our Refund and Cancellation Policy. Please note that once your order has been confirmed/paid, the delivery fee and buyer protection fee are non-refundable. Cancellations are only permitted within 5 minutes of placing an order if it has not yet been processed.'),
('inter_regional_terms', '1.0', 'Inter-Regional Shipping Terms', 'This order requires inter-regional transit. The transit times shown are estimates based on shipping partner schedules. If you do not opt for home delivery, you must collect your package from the destination hub. Returns for inter-regional orders do not refund transit/delivery costs.'),
('bargain_terms', '1.0', 'Bargaining Terms & Conditions', 'All bargaining offers are binding once accepted. You must checkout your accepted offer within the designated checkout window (typically 1 hour), after which the deal expires and is closed.'),
('flash_sale_terms', '1.0', 'Flash Sale Agreement', 'Products submitted for flash sales must match active slot dates and stock requirements. Flash sale prices are locked once approved by the administrator and cannot be increased.'),
('seller_commission', '1.0', 'Seller Onboarding Commission Agreement', 'Sellers are subject to platform commissions on all completed orders. Commission rates are managed by platform administrators and are automatically deducted from order payouts.'),
('driver_earnings', '1.0', 'Driver Earnings & Splits', 'Drivers earn a percentage share of delivery fees from completed orders, as configured by platform settings.'),
('payout_terms', '1.0', 'Payout Guidelines', 'Payouts are processed to verified store bank accounts. Processing times are subject to platform reviews and bank transfer schedules.')
ON CONFLICT (type) DO NOTHING;
