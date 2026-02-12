-- =====================================================
-- Shopyos E-commerce Platform
-- Migration 003: Payouts & Advanced Features
-- =====================================================

-- Payouts table
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    payout_method VARCHAR(50) NOT NULL, -- mb-money, bank, paypal
    payout_details JSONB, -- account number, bank name, etc.
    transaction_reference VARCHAR(100), -- external ref from payment provider
    admin_notes TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for payouts
CREATE INDEX idx_payouts_store_id ON payouts(store_id);
CREATE INDEX idx_payouts_status ON payouts(status);

-- Add payout settings to stores table (optional, but good for defaults)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS payout_details JSONB;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS current_balance DECIMAL(12, 2) DEFAULT 0;

-- Audit logs for balance changes
CREATE TABLE balance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- sale, withdrawal, refund, adjustment
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
    balance_after DECIMAL(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balance_logs_store ON balance_logs(store_id);
