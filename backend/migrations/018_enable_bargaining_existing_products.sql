-- Migration 018: Enable bargaining on all existing products
-- New products always get bargaining_enabled = true (set in productController).
-- This backfills existing products that were created with the DEFAULT FALSE.
UPDATE products
SET bargaining_enabled = TRUE
WHERE bargaining_enabled IS FALSE OR bargaining_enabled IS NULL;

-- Also tighten the column default so future raw inserts default to true
ALTER TABLE products ALTER COLUMN bargaining_enabled SET DEFAULT TRUE;
