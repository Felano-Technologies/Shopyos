-- Migration 050: Return & refund management
-- Structured flow for buyers to request returns, sellers to respond,
-- and admins to arbitrate disputes and issue refunds.

CREATE TABLE IF NOT EXISTS return_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason           TEXT        NOT NULL,
  reason_category  TEXT        CHECK (reason_category IN (
                     'wrong_item', 'damaged', 'not_as_described', 'changed_mind', 'other'
                   )),
  status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending', 'seller_approved', 'seller_declined',
                     'refund_issued', 'admin_review', 'closed'
                   )),
  evidence_images  TEXT[],
  seller_response  TEXT,
  admin_notes      TEXT,
  refund_amount    NUMERIC(10,2),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order
  ON return_requests (order_id);

CREATE INDEX IF NOT EXISTS idx_return_requests_buyer
  ON return_requests (buyer_id, created_at DESC);

-- Seller dashboard query: filter by seller + status
CREATE INDEX IF NOT EXISTS idx_return_requests_seller_status
  ON return_requests (seller_id, status);

-- Admin query: filter by status across all returns
CREATE INDEX IF NOT EXISTS idx_return_requests_status
  ON return_requests (status, created_at DESC);
