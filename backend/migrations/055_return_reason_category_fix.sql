-- Migration 055: fix return_requests.reason_category CHECK constraint
-- The buyer app (frontend/app/order/return-submit.tsx CATEGORIES) sends
-- 'defective' | 'wrong_item' | 'size_fit' | 'not_described' | 'other', but the
-- constraint from migration 050/001_initial_schema.sql only allowed
-- 'wrong_item' | 'damaged' | 'not_as_described' | 'changed_mind' | 'other',
-- so every submission using the first/third categories (and the new
-- 'size_fit' reason used by both returns and replacements) failed with a
-- 23514 check-constraint violation. Widen the constraint to accept both the
-- legacy values (any existing rows) and the ids the app actually sends.

ALTER TABLE return_requests DROP CONSTRAINT IF EXISTS return_requests_reason_category_check;
ALTER TABLE return_requests ADD CONSTRAINT return_requests_reason_category_check CHECK (reason_category IN (
  'wrong_item', 'damaged', 'not_as_described', 'changed_mind', 'other',
  'defective', 'size_fit', 'not_described'
));
