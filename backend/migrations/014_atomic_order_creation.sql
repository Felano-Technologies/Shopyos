-- Migration 014: Atomic Order Creation
-- Implements transactional order creation with check-and-decrement for inventory

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_order_number TEXT,
  p_buyer_id UUID,
  p_store_id UUID,
  p_subtotal NUMERIC,
  p_tax NUMERIC,
  p_delivery_fee NUMERIC,
  p_total_amount NUMERIC,
  p_delivery_address TEXT,
  p_delivery_city TEXT,
  p_delivery_country TEXT,
  p_delivery_phone TEXT,
  p_delivery_notes TEXT,
  p_payment_method TEXT,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_available INT;
  v_payment_id UUID;
BEGIN
  -- 1. Check and decrement inventory for each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE inventory
    SET quantity = quantity - (v_item->>'quantity')::INT,
        updated_at = NOW()
    WHERE product_id = (v_item->>'product_id')::UUID
      AND quantity >= (v_item->>'quantity')::INT;

    IF NOT FOUND THEN
      -- Get current stock for error message
      SELECT quantity INTO v_available FROM inventory
      WHERE product_id = (v_item->>'product_id')::UUID;

      RAISE EXCEPTION 'Insufficient stock for product %: requested %, available %',
        v_item->>'product_title',
        v_item->>'quantity',
        COALESCE(v_available, 0);
    END IF;
  END LOOP;

  -- 2. Insert order
  INSERT INTO orders (
    order_number, buyer_id, store_id, status,
    subtotal, tax, delivery_fee, total_amount,
    delivery_address_line1, delivery_city, delivery_country,
    delivery_phone, buyer_notes
  ) VALUES (
    p_order_number, p_buyer_id, p_store_id, 'pending',
    p_subtotal, p_tax, p_delivery_fee, p_total_amount,
    p_delivery_address, p_delivery_city, COALESCE(p_delivery_country, 'Ghana'),
    p_delivery_phone, p_delivery_notes
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

  -- 5. Return the created order
  RETURN jsonb_build_object(
    'id', v_order_id,
    'payment_id', v_payment_id,
    'order_number', p_order_number,
    'status', 'pending',
    'total_amount', p_total_amount
  );
END;
$$ LANGUAGE plpgsql;
