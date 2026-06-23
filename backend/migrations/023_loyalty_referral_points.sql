-- Migration 023: Referral reward → loyalty points + admin-configurable reward value

-- 1. Add referral_points_reward to platform_fee_config (category = 'loyalty')
INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value)
VALUES (
  'referral_points_reward', 10.00, 'integer', 'loyalty',
  'Referral Points Reward',
  'Number of loyalty points awarded to a referrer when the person they invited completes their first order.',
  1, 500
)
ON CONFLICT (config_key) DO NOTHING;

-- 2. Add related_user_id to loyalty_transactions (for referral — stores the referred user)
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Expand loyalty_transactions.type to include 'referral'
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_type_check;
ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_type_check
  CHECK (type IN ('earn', 'redeem', 'expire', 'admin_adjustment', 'referral'));

-- 4. Replace confirm_delivery_atomic: referral reward now credits loyalty points instead of wallet cash
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

    -- Handle referral reward: credit loyalty points to referrer instead of wallet cash
    DECLARE
        v_referral           RECORD;
        v_referral_points    INTEGER;
        v_referred_name      TEXT;
    BEGIN
        SELECT * INTO v_referral FROM referrals
        WHERE referred_id = v_order.buyer_id AND status = 'pending'
        LIMIT 1 FOR UPDATE;

        IF FOUND THEN
            -- Read admin-configured reward (default 10 if not set)
            SELECT config_value::INTEGER INTO v_referral_points
            FROM platform_fee_config WHERE config_key = 'referral_points_reward';
            IF NOT FOUND OR v_referral_points IS NULL THEN v_referral_points := 10; END IF;

            -- Get referred user's display name for the transaction description
            SELECT full_name INTO v_referred_name
            FROM user_profiles WHERE user_id = v_order.buyer_id;

            UPDATE referrals SET
                status       = 'completed',
                order_id     = p_order_id,
                completed_at = v_now
            WHERE id = v_referral.id;

            -- Credit loyalty points to the referrer
            INSERT INTO loyalty_points (user_id, balance, lifetime_earned)
            VALUES (v_referral.referrer_id, v_referral_points, v_referral_points)
            ON CONFLICT (user_id) DO UPDATE SET
                balance         = loyalty_points.balance + v_referral_points,
                lifetime_earned = loyalty_points.lifetime_earned + v_referral_points,
                updated_at      = v_now;

            -- Log the referral transaction (related_user_id = the referred person)
            INSERT INTO loyalty_transactions (user_id, order_id, type, points, description, related_user_id)
            VALUES (
                v_referral.referrer_id,
                p_order_id,
                'referral',
                v_referral_points,
                'Referral bonus — ' || COALESCE(v_referred_name, 'a friend') || ' placed their first order',
                v_order.buyer_id
            );
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
