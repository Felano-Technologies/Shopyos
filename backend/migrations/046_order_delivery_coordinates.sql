-- 046_order_delivery_coordinates.sql
-- create_order_atomic never accepted delivery destination coordinates, so
-- orders.delivery_latitude/longitude (columns already exist from 001_initial_schema.sql)
-- stayed NULL forever, and createAndDispatchDelivery defaulted every delivery's
-- coordinates to 0,0 — breaking the driver's live map pin. Adds two optional
-- trailing params so existing callers keep working unchanged until the
-- frontend/backend pass real geocoded coordinates through.

CREATE OR REPLACE FUNCTION create_order_atomic(
    p_order_number   TEXT,
    p_buyer_id       UUID,
    p_store_id       UUID,
    p_subtotal       NUMERIC,
    p_tax            NUMERIC,
    p_delivery_fee   NUMERIC,
    p_total_amount   NUMERIC,
    p_delivery_address TEXT,
    p_delivery_city  TEXT,
    p_delivery_country TEXT,
    p_delivery_phone TEXT,
    p_delivery_notes TEXT,
    p_payment_method TEXT,
    p_items          JSONB,
    p_buyer_protection_fee NUMERIC DEFAULT 0,
    p_delivery_latitude  NUMERIC DEFAULT NULL,
    p_delivery_longitude NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
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
        subtotal, tax, delivery_fee, total_amount, buyer_protection_fee,
        delivery_address_line1, delivery_city, delivery_country,
        delivery_phone, buyer_notes,
        delivery_latitude, delivery_longitude
    ) VALUES (
        p_order_number, p_buyer_id, p_store_id, 'pending',
        p_subtotal, p_tax, p_delivery_fee, p_total_amount, p_buyer_protection_fee,
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
$$ LANGUAGE plpgsql;
