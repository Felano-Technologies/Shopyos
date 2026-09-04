-- Migration 041: Let buyers remove completed orders from their own order history.
-- This hides the order from the buyer's list only — the row (and the seller's/
-- admin's view of it, plus payments/deliveries/loyalty history) is untouched.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_hidden_at TIMESTAMPTZ;
