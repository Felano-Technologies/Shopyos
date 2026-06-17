-- 025_add_referrals.sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed'
    reward_amount DECIMAL(10,2) DEFAULT 20.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
