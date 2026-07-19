-- 036: hub balances + payout split for inter-regional deliveries
--
-- Payout timing (confirmed):
--   * First-mile driver -> paid immediately when their hub drop-off is verified
--     (deliveryController.verifyHubDropoff), same moment the order advances to
--     at_origin_hub. They don't wait on the buyer.
--   * Hub(s) -> paid when the parcel arrives at the destination hub
--     (parcelPartnerController.arriveParcel) — the point both hubs' work is
--     verifiably complete and the last-mile phase begins. Split 50/50 between
--     origin and destination hub.
--   * Last-mile driver + seller -> paid at final buyer delivery confirmation,
--     exactly like a local order (confirm_delivery_atomic, unchanged).

-- Platform keeps a cut of the transit fee, same shape as driver_earnings_percentage.
INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value)
VALUES (
  'hub_earnings_percentage', 88.00, 'percentage', 'delivery',
  'Hub Earnings Percentage',
  'Percentage of the parcel transit fee paid out to the origin+destination hubs combined (split 50/50); remainder is platform margin',
  50, 100
)
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE parcel_partner_hubs ADD COLUMN IF NOT EXISTS current_balance DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS hub_balance_logs (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    hub_id           UUID        NOT NULL REFERENCES parcel_partner_hubs(id) ON DELETE CASCADE,
    amount           DECIMAL(12, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    order_id         UUID        REFERENCES orders(id) ON DELETE SET NULL,
    balance_after    DECIMAL(12, 2),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_balance_logs_hub   ON hub_balance_logs(hub_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_balance_logs_order ON hub_balance_logs(order_id);

-- Guard against double-crediting the transit fee if arriveParcel is somehow
-- invoked twice for the same order (UI shouldn't allow it, but the ledger
-- shouldn't trust that alone).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transit_fee_paid_at TIMESTAMPTZ;
