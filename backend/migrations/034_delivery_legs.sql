-- 034: support multiple delivery legs per order (inter-regional first-mile + last-mile)
--
-- An inter-regional order needs two driver deliveries on the same order:
--   * first_mile: store -> origin hub (origin-region driver)
--   * last_mile:  destination hub -> buyer (destination-region driver)
-- The original schema made deliveries.order_id UNIQUE, allowing only one.
-- Local orders keep a single leg='local' delivery and behave exactly as before.

-- 1. Drop the one-delivery-per-order constraint (the non-unique index
--    idx_deliveries_order_id from 001 stays for lookups).
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_order_id_key;

-- 2. Tag each delivery with which leg of the journey it represents.
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS leg VARCHAR(20) NOT NULL DEFAULT 'local';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deliveries_leg_check'
  ) THEN
    ALTER TABLE deliveries
      ADD CONSTRAINT deliveries_leg_check
      CHECK (leg IN ('local', 'first_mile', 'last_mile'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deliveries_order_leg ON deliveries(order_id, leg);

-- 3. Backfill: any delivery already wired as an order's last-mile becomes last_mile;
--    everything else remains 'local'.
UPDATE deliveries d
SET leg = 'last_mile'
FROM orders o
WHERE o.last_mile_delivery_id = d.id
  AND d.leg = 'local';

-- 4. The payout / PIN RPCs selected the delivery by order_id alone, which now
--    matches more than one row. Re-point them at the BUYER-FACING leg (the
--    delivery that actually ends at the customer) — never the first_mile leg,
--    whose driver is paid separately and must not trigger order completion.
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

    SELECT * INTO v_store FROM stores WHERE id = v_order.store_id FOR UPDATE;
    -- Buyer-facing leg only: last_mile (inter-regional) or local; skip first_mile.
    SELECT * INTO v_delivery
    FROM deliveries
    WHERE order_id = p_order_id AND leg <> 'first_mile'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    v_seller_payout := v_order.subtotal * 0.95;

    IF v_delivery.id IS NOT NULL AND v_delivery.driver_id IS NOT NULL THEN
        v_driver_payout := v_order.delivery_fee * 0.85;
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

CREATE OR REPLACE FUNCTION verify_delivery_pin(
    p_order_id  UUID,
    p_driver_id UUID,
    p_pin       VARCHAR(6)
) RETURNS JSONB AS $$
DECLARE
    v_order    RECORD;
    v_delivery RECORD;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    -- Buyer-facing leg only: last_mile (inter-regional) or local; skip first_mile.
    SELECT * INTO v_delivery
    FROM deliveries
    WHERE order_id = p_order_id AND leg <> 'first_mile'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_order.id IS NULL OR v_delivery.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order or delivery not found');
    END IF;

    IF v_delivery.driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not the assigned driver for this order');
    END IF;

    IF v_order.verification_pin IS NULL OR v_order.verification_pin != p_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid verification PIN');
    END IF;

    UPDATE orders SET
        pin_verified_at   = NOW(),
        verification_pin  = NULL
    WHERE id = p_order_id;

    RETURN confirm_delivery_atomic(p_order_id, v_order.buyer_id, TRUE);
END;
$$ LANGUAGE plpgsql;
