-- 022_payout_system.sql
-- Extends payout infrastructure:
--   - Driver payout support (driver_id on payouts, payout_details on user_profiles)
--   - Return-window locking (payout_eligible_at on balance_logs + wallet_logs)
--   - New fee config entries (return_window_days, min_driver_payout)
--   - Updated confirm_delivery_atomic() to stamp payout_eligible_at

-- 1. payouts: add driver_id, make store_id nullable
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS payout_type VARCHAR(20) DEFAULT 'seller'; -- 'seller' | 'driver'
DO $$ BEGIN
    ALTER TABLE payouts ALTER COLUMN store_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. balance_logs: add payout_eligible_at + notes
ALTER TABLE balance_logs ADD COLUMN IF NOT EXISTS payout_eligible_at TIMESTAMPTZ;
ALTER TABLE balance_logs ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. wallet_logs: add payout_eligible_at
ALTER TABLE wallet_logs ADD COLUMN IF NOT EXISTS payout_eligible_at TIMESTAMPTZ;

-- 4. user_profiles: add payout fields for drivers
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payout_method  VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payout_details JSONB;

-- 5. Indexes for scheduler queries
CREATE INDEX IF NOT EXISTS idx_payouts_driver_id          ON payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_type        ON payouts(payout_type);
CREATE INDEX IF NOT EXISTS idx_balance_logs_eligible      ON balance_logs(payout_eligible_at) WHERE payout_eligible_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_logs_eligible       ON wallet_logs(payout_eligible_at)  WHERE payout_eligible_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_payout_meth  ON user_profiles(payout_method)     WHERE payout_method IS NOT NULL;

-- 6. New fee config entries
INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value)
VALUES
  ('return_window_days', 7.00, 'integer', 'payout',
   'Return Window Days',
   'Days after delivery before seller balance entry is eligible for payout. Gives time for returns to be filed.',
   1, 30),
  ('min_driver_payout', 10.00, 'fixed', 'payout',
   'Minimum Driver Payout Amount',
   'Minimum wallet balance a driver needs for the nightly auto-payout to trigger',
   1, 500)
ON CONFLICT (config_key) DO NOTHING;

-- 7. Update confirm_delivery_atomic() to stamp payout_eligible_at
CREATE OR REPLACE FUNCTION confirm_delivery_atomic(
    p_order_id UUID,
    p_user_id  UUID,
    p_is_admin BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_order               RECORD;
    v_store               RECORD;
    v_seller_payout       DECIMAL(12, 2);
    v_driver_payout       DECIMAL(12, 2);
    v_platform_fee        DECIMAL(12, 2);
    v_new_store_balance   DECIMAL(12, 2);
    v_new_driver_balance  DECIMAL(12, 2);
    v_now                 TIMESTAMPTZ := NOW();
    v_delivery            RECORD;
    v_seller_payout_pct   DECIMAL(12, 4);
    v_driver_earnings_pct DECIMAL(12, 4);
    v_return_window_days  INTEGER;
    v_seller_eligible_at  TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF NOT p_is_admin AND v_order.buyer_id != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_order.escrow_status != 'HELD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Funds are not held in escrow');
    END IF;

    SELECT * INTO v_store    FROM stores     WHERE id       = v_order.store_id FOR UPDATE;
    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id       FOR UPDATE;

    -- Fetch seller payout percentage from config
    SELECT config_value INTO v_seller_payout_pct
    FROM platform_fee_config WHERE config_key = 'seller_payout_percentage';
    IF NOT FOUND THEN v_seller_payout_pct := 90.00; END IF;

    -- Fetch driver earnings split from config
    SELECT config_value INTO v_driver_earnings_pct
    FROM platform_fee_config WHERE config_key = 'driver_earnings_percentage';
    IF NOT FOUND THEN v_driver_earnings_pct := 85.00; END IF;

    -- Fetch return window days from config
    SELECT config_value::INTEGER INTO v_return_window_days
    FROM platform_fee_config WHERE config_key = 'return_window_days';
    IF NOT FOUND THEN v_return_window_days := 7; END IF;

    -- Seller payout eligible after return window
    v_seller_eligible_at := v_now + (v_return_window_days || ' days')::INTERVAL;

    v_seller_payout := v_order.subtotal * (v_seller_payout_pct / 100.0);

    IF v_delivery.id IS NOT NULL AND v_delivery.driver_id IS NOT NULL THEN
        v_driver_payout := v_order.delivery_fee * (v_driver_earnings_pct / 100.0);
    ELSE
        v_driver_payout := 0;
    END IF;

    v_platform_fee := v_order.total_amount - v_seller_payout - v_driver_payout;

    UPDATE orders SET
        status               = 'completed',
        escrow_status        = 'RELEASED',
        platform_fee         = v_platform_fee,
        seller_payout_amount = v_seller_payout,
        payout_released_at   = v_now,
        updated_at           = v_now
    WHERE id = p_order_id;

    v_new_store_balance := COALESCE(v_store.current_balance, 0) + v_seller_payout;
    UPDATE stores SET current_balance = v_new_store_balance WHERE id = v_store.id;
    INSERT INTO balance_logs (store_id, amount, transaction_type, order_id, balance_after, payout_eligible_at)
    VALUES (v_store.id, v_seller_payout, 'sale', p_order_id, v_new_store_balance, v_seller_eligible_at);

    IF v_driver_payout > 0 THEN
        UPDATE user_profiles SET
            wallet_balance = COALESCE(wallet_balance, 0) + v_driver_payout,
            updated_at     = v_now
        WHERE user_id = v_delivery.driver_id;

        SELECT wallet_balance INTO v_new_driver_balance
        FROM user_profiles WHERE user_id = v_delivery.driver_id;

        -- Driver payout eligible immediately (delivery fees are non-refundable)
        INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after, payout_eligible_at)
        VALUES (v_delivery.driver_id, v_driver_payout, 'earning', p_order_id, v_new_driver_balance, v_now);

        UPDATE deliveries SET
            status          = 'delivered',
            delivered_at    = v_now,
            driver_earnings = v_driver_payout,
            updated_at      = v_now
        WHERE id = v_delivery.id;
    END IF;

    -- Handle referral reward atomically
    DECLARE
        v_referral        RECORD;
        v_referrer_wallet DECIMAL(12, 2);
    BEGIN
        SELECT * INTO v_referral FROM referrals
        WHERE referred_id = v_order.buyer_id AND status = 'pending'
        LIMIT 1 FOR UPDATE;

        IF FOUND THEN
            UPDATE referrals SET
                status       = 'completed',
                order_id     = p_order_id,
                completed_at = v_now
            WHERE id = v_referral.id;

            UPDATE user_profiles SET
                wallet_balance = COALESCE(wallet_balance, 0) + v_referral.reward_amount,
                updated_at     = v_now
            WHERE user_id = v_referral.referrer_id;

            SELECT wallet_balance INTO v_referrer_wallet
            FROM user_profiles WHERE user_id = v_referral.referrer_id;

            INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after)
            VALUES (v_referral.referrer_id, v_referral.reward_amount, 'referral_reward', p_order_id, v_referrer_wallet);
        END IF;
    END;

    RETURN jsonb_build_object(
        'success',       true,
        'message',       'Delivery confirmed and funds released',
        'seller_payout', v_seller_payout,
        'driver_payout', v_driver_payout,
        'platform_fee',  v_platform_fee
    );
END;
$$ LANGUAGE plpgsql;
