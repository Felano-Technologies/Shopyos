-- Migration 053: Replacement resolution for return_requests
-- Adds a resolution_type discriminator so a buyer can request a variant swap
-- (e.g. wrong size/color) instead of a refund, reusing the existing
-- buyer -> seller -> admin return-request flow.

ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS resolution_type          TEXT NOT NULL DEFAULT 'refund'
                             CHECK (resolution_type IN ('refund', 'replacement')),
  ADD COLUMN IF NOT EXISTS order_item_id             UUID REFERENCES order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_variant_id         UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_shipped_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replacement_delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replacement_tracking_info TEXT;

-- Widen the status state machine to include the replacement lifecycle.
ALTER TABLE return_requests DROP CONSTRAINT IF EXISTS return_requests_status_check;
ALTER TABLE return_requests ADD CONSTRAINT return_requests_status_check CHECK (status IN (
  'pending', 'seller_approved', 'seller_declined',
  'refund_issued', 'admin_review', 'closed',
  'replacement_approved', 'replacement_shipped', 'replacement_delivered'
));

CREATE INDEX IF NOT EXISTS idx_return_requests_resolution_type ON return_requests (resolution_type);

-- Extend vw_return_request_detail with the new columns and the original /
-- target variant details needed by the buyer app to render a replacement.
CREATE OR REPLACE VIEW vw_return_request_detail AS
SELECT
  rr.id,
  rr.status,
  rr.reason,
  rr.reason_category,
  rr.evidence_images,
  rr.seller_response,
  rr.admin_notes,
  rr.refund_amount,
  rr.created_at,
  rr.resolved_at,
  rr.delivery_fee_at_time,
  rr.refundable_amount,
  rr.resolution_type,
  rr.order_item_id,
  rr.target_variant_id,
  rr.replacement_shipped_at,
  rr.replacement_delivered_at,
  rr.replacement_tracking_info,
  rr.order_id,
  o.order_number,
  o.total_amount  AS order_total,
  rr.buyer_id,
  up.full_name    AS buyer_name,
  u.email         AS buyer_email,
  rr.seller_id,
  o.store_id,
  s.store_name,
  oi.product_title       AS returned_product_title,
  oi.variant_id          AS original_variant_id,
  oi.variant_attributes  AS original_variant_attributes,
  tv.attributes           AS target_variant_attributes,
  tv.sku                   AS target_variant_sku,
  tv.price                 AS target_variant_price,
  tv.stock_quantity        AS target_variant_stock
FROM return_requests rr
JOIN orders o ON o.id = rr.order_id
JOIN users u ON u.id = rr.buyer_id
LEFT JOIN user_profiles up ON up.user_id = rr.buyer_id
JOIN stores s ON s.id = o.store_id
LEFT JOIN order_items oi ON oi.id = rr.order_item_id
LEFT JOIN product_variants tv ON tv.id = rr.target_variant_id;
