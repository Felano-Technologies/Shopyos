-- Migration: 035 Atomic Delivery and PIN Verification
-- Description: Standardizes delivery confirmation, adds atomic fund release, and PIN verification.

-- 1. Add PIN columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_pin VARCHAR(6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pin_verified_at TIMESTAMPTZ;

-- 2. Create wallet_logs table for users (drivers/referrers)
CREATE TABLE IF NOT EXISTS wallet_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- earning, withdrawal, referral_reward, adjustment
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    balance_after DECIMAL(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_logs_user ON wallet_logs(user_id);

-- 3. Atomic Delivery Confirmation Function
CREATE OR REPLACE FUNCTION confirm_delivery_atomic(
    p_order_id UUID,
    p_user_id UUID, -- The person confirming (Buyer or Admin)
    p_is_admin BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_store RECORD;
    v_buyer_profile RECORD;
    v_seller_payout DECIMAL(12, 2);
    v_driver_payout DECIMAL(12, 2);
    v_platform_fee DECIMAL(12, 2);
    v_new_store_balance DECIMAL(12, 2);
    v_new_driver_balance DECIMAL(12, 2);
    v_now TIMESTAMPTZ := NOW();
    v_delivery RECORD;
BEGIN
    -- 1. Fetch and Lock Order
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- 2. Authorization & Status Check
    IF NOT p_is_admin AND v_order.buyer_id != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_order.escrow_status != 'HELD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Funds are not held in escrow');
    END IF;

    -- 3. Fetch Store and Delivery
    SELECT * INTO v_store FROM stores WHERE id = v_order.store_id FOR UPDATE;
    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id FOR UPDATE;

    -- 4. Calculate Payouts
    -- Logic: 
    -- Platform takes Tax (₵1.00 usually)
    -- Platform takes 5% of subtotal
    -- Driver gets 85% of delivery_fee (Platform takes 15%)
    
    v_seller_payout := v_order.subtotal * 0.95;
    
    IF v_delivery.id IS NOT NULL AND v_delivery.driver_id IS NOT NULL THEN
        v_driver_payout := v_order.delivery_fee * 0.85;
    ELSE
        v_driver_payout := 0;
    END IF;
    
    v_platform_fee := v_order.total_amount - v_seller_payout - v_driver_payout;

    -- 5. Update Order
    UPDATE orders SET 
        status = 'completed',
        escrow_status = 'RELEASED',
        platform_fee = v_platform_fee,
        seller_payout_amount = v_seller_payout,
        payout_released_at = v_now,
        updated_at = v_now
    WHERE id = p_order_id;

    -- 6. Credit Seller (Store Balance)
    v_new_store_balance := COALESCE(v_store.current_balance, 0) + v_seller_payout;
    UPDATE stores SET current_balance = v_new_store_balance WHERE id = v_store.id;

    INSERT INTO balance_logs (store_id, amount, transaction_type, order_id, balance_after)
    VALUES (v_store.id, v_seller_payout, 'sale', p_order_id, v_new_store_balance);

    -- 7. Credit Driver (User Wallet)
    IF v_driver_payout > 0 THEN
        UPDATE user_profiles SET 
            wallet_balance = COALESCE(wallet_balance, 0) + v_driver_payout,
            updated_at = v_now
        WHERE user_id = v_delivery.driver_id;
        
        -- Get new balance for logging
        SELECT wallet_balance INTO v_new_driver_balance FROM user_profiles WHERE user_id = v_delivery.driver_id;

        INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after)
        VALUES (v_delivery.driver_id, v_driver_payout, 'earning', p_order_id, v_new_driver_balance);
        
        -- Update delivery status if not already delivered
        UPDATE deliveries SET 
            status = 'delivered',
            delivered_at = v_now,
            driver_earnings = v_driver_payout,
            updated_at = v_now
        WHERE id = v_delivery.id;
    END IF;

    -- 8. Handle Referrals
    -- (Logic moved from JS to SQL for atomicity)
    DECLARE
        v_referral RECORD;
        v_referrer_wallet DECIMAL(12, 2);
    BEGIN
        SELECT * INTO v_referral FROM referrals 
        WHERE referred_id = v_order.buyer_id AND status = 'pending' 
        LIMIT 1 FOR UPDATE;

        IF FOUND THEN
            UPDATE referrals SET 
                status = 'completed', 
                order_id = p_order_id, 
                completed_at = v_now 
            WHERE id = v_referral.id;

            UPDATE user_profiles SET 
                wallet_balance = COALESCE(wallet_balance, 0) + v_referral.reward_amount,
                updated_at = v_now
            WHERE user_id = v_referral.referrer_id;
            
            SELECT wallet_balance INTO v_referrer_wallet FROM user_profiles WHERE user_id = v_referral.referrer_id;

            INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after)
            VALUES (v_referral.referrer_id, v_referral.reward_amount, 'referral_reward', p_order_id, v_referrer_wallet);
        END IF;
    END;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Delivery confirmed and funds released',
        'seller_payout', v_seller_payout,
        'driver_payout', v_driver_payout,
        'platform_fee', v_platform_fee
    );
END;
$$ LANGUAGE plpgsql;

-- 4. PIN Verification Function
CREATE OR REPLACE FUNCTION verify_delivery_pin(
    p_order_id UUID,
    p_driver_id UUID,
    p_pin VARCHAR(6)
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_delivery RECORD;
BEGIN
    -- 1. Fetch Order and Delivery
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR v_delivery.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order or delivery not found');
    END IF;

    -- 2. Authorization
    IF v_delivery.driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not the assigned driver for this order');
    END IF;

    -- 3. PIN Check
    IF v_order.verification_pin IS NULL OR v_order.verification_pin != p_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid verification PIN');
    END IF;

    -- 4. Mark as Verified
    UPDATE orders SET 
        pin_verified_at = NOW(),
        verification_pin = NULL -- Optional: Clear PIN after use
    WHERE id = p_order_id;

    -- 5. Call Confirmation Logic
    -- Note: We pass p_driver_id as the user_id, but we must signal it's authorized.
    -- Since the PIN was correct, we treat it as buyer-authorized.
    RETURN confirm_delivery_atomic(p_order_id, v_order.buyer_id, TRUE);
END;
$$ LANGUAGE plpgsql;
