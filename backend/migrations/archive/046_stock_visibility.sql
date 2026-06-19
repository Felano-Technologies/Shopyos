-- Migration 046: Stock Visibility
--
-- 1. Adds is_in_stock flag to products so zero-stock items can be hidden
--    from buyer-facing listings without touching the seller's is_active flag.
-- 2. Adds a trigger that keeps is_in_stock in sync whenever inventory changes.
-- 3. Replaces create_order_atomic with a version that uses SELECT FOR UPDATE
--    to make the concurrency intent explicit and prevent any race window.

-- ── 1. Add column ─────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_in_stock BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. Back-fill existing rows ────────────────────────────────────────────────
-- Mark products whose inventory is currently 0 and don't allow backorders
UPDATE products p
SET is_in_stock = FALSE
WHERE EXISTS (
  SELECT 1 FROM inventory i
  WHERE i.product_id = p.id
    AND i.quantity <= 0
    AND i.allow_backorder = FALSE
);

-- ── 3. Trigger function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_sync_is_in_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- allow_backorder = TRUE means "always show even at 0 stock"
  IF NEW.allow_backorder = TRUE THEN
    UPDATE products SET is_in_stock = TRUE WHERE id = NEW.product_id;
    RETURN NEW;
  END IF;

  IF NEW.quantity <= 0 THEN
    UPDATE products SET is_in_stock = FALSE WHERE id = NEW.product_id;
  ELSE
    UPDATE products SET is_in_stock = TRUE  WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 4. Attach trigger ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_inventory_stock_status ON inventory;
CREATE TRIGGER trg_inventory_stock_status
AFTER INSERT OR UPDATE OF quantity, allow_backorder ON inventory
FOR EACH ROW
EXECUTE FUNCTION trg_sync_is_in_stock();

-- ── 5. Replace create_order_atomic with SELECT FOR UPDATE locking ─────────────
--
-- Why SELECT FOR UPDATE?
--
--   When two buyers click "Place Order" at the same time for the last item:
--
--   T1: SELECT FOR UPDATE → locks the inventory row, reads quantity = 1
--   T2: SELECT FOR UPDATE → waits (blocked by T1's lock)
--   T1: checks 1 >= 1 ✓, UPDATE quantity = 0, COMMIT → releases lock
--   T2: now unblocked, reads quantity = 0, checks 0 >= 1 ✗ → raises error
--
--   Without FOR UPDATE, both transactions could theoretically read quantity = 1
--   before either writes, letting both decrement (→ -1).  PostgreSQL's row-level
--   UPDATE lock makes the plain UPDATE approach safe too, but FOR UPDATE is
--   explicit and guards multi-statement logic inside the function.

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
  v_requested INT;
BEGIN
  -- 1. Lock each inventory row and verify sufficient stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_requested := (v_item->>'quantity')::INT;

    -- SELECT FOR UPDATE: lock this row so no other transaction can
    -- read or modify it until we COMMIT or ROLLBACK.
    SELECT quantity INTO v_available
    FROM inventory
    WHERE product_id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF v_available IS NULL THEN
      RAISE EXCEPTION 'Product % not found in inventory', v_item->>'product_title';
    END IF;

    IF v_available < v_requested THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %',
        v_item->>'product_title',
        v_requested,
        v_available;
    END IF;

    -- Decrement (safe: row is locked, no other transaction can modify it)
    UPDATE inventory
    SET quantity   = quantity - v_requested,
        updated_at = NOW()
    WHERE product_id = (v_item->>'product_id')::UUID;

    -- The trigger trg_inventory_stock_status fires here and sets
    -- products.is_in_stock = FALSE if quantity dropped to 0.
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
    'id',           v_order_id,
    'payment_id',   v_payment_id,
    'order_number', p_order_number,
    'status',       'pending',
    'total_amount', p_total_amount
  );
END;
$$ LANGUAGE plpgsql;
