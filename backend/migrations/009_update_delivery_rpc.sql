-- Update confirm_delivery_atomic to read payouts from platform_fee_config
CREATE OR REPLACE FUNCTION confirm_delivery_atomic(
    p_order_id UUID,
    p_user_id  UUID,
    p_is_admin BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_order             RECORD;
    v_store             RECORD;
    v_seller_payout     DECIMAL(12, 2);
    v_driver_payout     DECIMAL(12, 2);
    v_platform_fee      DECIMAL(12, 2);
    v_new_store_balance DECIMAL(12, 2);
    v_new_driver_balance DECIMAL(12, 2);
    v_now               TIMESTAMPTZ := NOW();
    v_delivery          RECORD;
    v_seller_payout_pct DECIMAL(12, 4);
    v_driver_earnings_pct DECIMAL(12, 4);
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
    FROM platform_fee_config
    WHERE config_key = 'seller_payout_percentage';
    
    IF NOT FOUND THEN
        v_seller_payout_pct := 90.00;
    END IF;

    -- Fetch driver earnings split from config
    SELECT config_value INTO v_driver_earnings_pct
    FROM platform_fee_config
    WHERE config_key = 'driver_earnings_percentage';
    
    IF NOT FOUND THEN
        v_driver_earnings_pct := 85.00;
    END IF;

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
    INSERT INTO balance_logs (store_id, amount, transaction_type, order_id, balance_after)
    VALUES (v_store.id, v_seller_payout, 'sale', p_order_id, v_new_store_balance);

    IF v_driver_payout > 0 THEN
        UPDATE user_profiles SET
            wallet_balance = COALESCE(wallet_balance, 0) + v_driver_payout,
            updated_at     = v_now
        WHERE user_id = v_delivery.driver_id;

        SELECT wallet_balance INTO v_new_driver_balance
        FROM user_profiles WHERE user_id = v_delivery.driver_id;

        INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after)
        VALUES (v_delivery.driver_id, v_driver_payout, 'earning', p_order_id, v_new_driver_balance);

        UPDATE deliveries SET
            status         = 'delivered',
            delivered_at   = v_now,
            driver_earnings = v_driver_payout,
            updated_at     = v_now
        WHERE id = v_delivery.id;
    END IF;

    -- Handle referral reward atomically
    DECLARE
        v_referral       RECORD;
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
