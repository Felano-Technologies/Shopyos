-- 069: rename "buyer protection fee" to "marketplace fee" throughout.
-- Purely a naming change — same computation (percentage of order subtotal,
-- configured via platform_fee_config), just no longer branded as buyer
-- protection. See backend/services/feeConfigService.js for the calculation.

ALTER TABLE orders RENAME COLUMN buyer_protection_fee TO marketplace_fee;

UPDATE platform_fee_config
SET config_key = 'marketplace_fee_pct',
    category = 'marketplace_fee',
    label = 'Marketplace Fee Rate',
    description = 'Percentage of order subtotal charged as the marketplace fee'
WHERE config_key = 'buyer_protection_pct';

UPDATE platform_fee_config
SET config_key = 'marketplace_fee_enabled',
    category = 'marketplace_fee',
    label = 'Enable Marketplace Fee',
    description = '1 = enabled, 0 = disabled'
WHERE config_key = 'buyer_protection_enabled';

-- Historical reserve_logs rows keep their old transaction_type value
-- ('protection_fee_collected') for audit-trail fidelity; only new rows use
-- the renamed value going forward (see paymentController.js).

UPDATE platform_disclaimers
SET content = 'By proceeding with this payment, you agree to our Refund and Cancellation Policy. Please note that once your order has been confirmed/paid, the delivery fee and marketplace fee are non-refundable. Cancellations are only permitted within 5 minutes of placing an order if it has not yet been processed.'
WHERE type = 'refund_policy';

-- Recreate the current create_order_atomic overload (the one with lat/lng
-- params) with the renamed argument — Postgres won't let CREATE OR REPLACE
-- rename an input parameter, so the old signature must be dropped first.
DROP FUNCTION IF EXISTS public.create_order_atomic(
  text, uuid, uuid, numeric, numeric, numeric, numeric, text, text, text, text, text, text, jsonb, numeric, numeric, numeric
);

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order_number text, p_buyer_id uuid, p_store_id uuid, p_subtotal numeric, p_tax numeric,
  p_delivery_fee numeric, p_total_amount numeric, p_delivery_address text, p_delivery_city text,
  p_delivery_country text, p_delivery_phone text, p_delivery_notes text, p_payment_method text,
  p_items jsonb, p_marketplace_fee numeric DEFAULT 0,
  p_delivery_latitude numeric DEFAULT NULL::numeric, p_delivery_longitude numeric DEFAULT NULL::numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_order_id   UUID;
    v_item       JSONB;
    v_available  INT;
    v_payment_id UUID;
    v_requested  INT;
BEGIN
    -- 1. Lock each inventory row and verify stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_requested := (v_item->>'quantity')::INT;

        SELECT quantity INTO v_available
        FROM inventory
        WHERE product_id = (v_item->>'product_id')::UUID
        FOR UPDATE;

        IF v_available IS NULL THEN
            RAISE EXCEPTION 'Product % not found in inventory', v_item->>'product_title';
        END IF;

        IF v_available < v_requested THEN
            RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %',
                v_item->>'product_title', v_requested, v_available;
        END IF;

        UPDATE inventory
        SET quantity   = quantity - v_requested,
            updated_at = NOW()
        WHERE product_id = (v_item->>'product_id')::UUID;
    END LOOP;

    -- 2. Insert order
    INSERT INTO orders (
        order_number, buyer_id, store_id, status,
        subtotal, tax, delivery_fee, total_amount, marketplace_fee,
        delivery_address_line1, delivery_city, delivery_country,
        delivery_phone, buyer_notes,
        delivery_latitude, delivery_longitude
    ) VALUES (
        p_order_number, p_buyer_id, p_store_id, 'pending',
        p_subtotal, p_tax, p_delivery_fee, p_total_amount, p_marketplace_fee,
        p_delivery_address, p_delivery_city, COALESCE(p_delivery_country, 'Ghana'),
        p_delivery_phone, p_delivery_notes,
        p_delivery_latitude, p_delivery_longitude
    ) RETURNING id INTO v_order_id;

    -- 3. Insert order items
    INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
    SELECT
        v_order_id,
        (item->>'product_id')::UUID,
        item->>'product_title',
        (item->>'quantity')::INT,
        (item->>'price')::NUMERIC,
        (item->>'subtotal')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;

    -- 4. Insert payment record
    INSERT INTO payments (order_id, payment_method, amount, status)
    VALUES (v_order_id, p_payment_method::payment_method, p_total_amount, 'pending')
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'id',           v_order_id,
        'payment_id',   v_payment_id,
        'order_number', p_order_number,
        'status',       'pending',
        'total_amount', p_total_amount
    );
END;
$function$;
