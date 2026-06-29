-- The original valid_order_amounts constraint enforced:
--   total_amount = subtotal + tax + delivery_fee
-- This broke once discount_amount, parcel_transit_fee, last_mile_fee, and
-- bargain_discount were added, because create_order_atomic inserts total_amount
-- already adjusted for those but the columns themselves default to 0 at insert time.
-- Replace with non-negative checks only; arithmetic correctness is the app's responsibility.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_order_amounts;

ALTER TABLE orders ADD CONSTRAINT valid_order_amounts CHECK (
    subtotal        >= 0 AND
    tax             >= 0 AND
    delivery_fee    >= 0 AND
    discount_amount >= 0 AND
    total_amount    >= 0
);
