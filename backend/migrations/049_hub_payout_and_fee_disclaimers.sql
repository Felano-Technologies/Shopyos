-- 049_hub_payout_and_fee_disclaimers.sql
-- (1) Hub-to-user ownership binding + payout method, so a parcel-partner hub
--     can request its own payout the same way sellers/drivers already do.
-- (2) payouts.hub_id, so a hub payout can be recorded like seller/driver ones.
-- (3) Disclaimer content updates disclosing the specific new platform-fee
--     percentages, plus a new hub-specific disclaimer type. Version bumps
--     force existing acknowledgements to no longer match, so every seller
--     must re-agree to the updated, specific disclosure.

ALTER TABLE parcel_partner_hubs
    ADD COLUMN IF NOT EXISTS owner_id      UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS payout_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payout_details JSONB;

CREATE INDEX IF NOT EXISTS idx_parcel_partner_hubs_owner ON parcel_partner_hubs(owner_id);

ALTER TABLE payouts
    ADD COLUMN IF NOT EXISTS hub_id UUID REFERENCES parcel_partner_hubs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_payouts_hub_id ON payouts(hub_id);
COMMENT ON COLUMN payouts.payout_type IS 'seller | driver | hub';

ALTER TABLE hub_balance_logs
    ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL;

UPDATE platform_disclaimers
SET title = 'Seller Platform Fee Agreement',
    content = 'Shopyos charges a 5% Seller Platform Fee on every successful sale, automatically deducted from your order payout. You receive 95% of the product price; this replaces any product-listing fee — listing products is free.',
    version = '2.0'
WHERE type = 'seller_commission';

UPDATE platform_disclaimers
SET title = 'Payout Terms',
    content = 'Payouts reflect your order proceeds after the 5% Seller Platform Fee has been deducted. Payouts are processed to verified store bank/mobile money accounts; processing times are subject to platform review and transfer schedules.',
    version = '2.0'
WHERE type = 'payout_terms';

UPDATE platform_disclaimers
SET title = 'Driver Earnings & Platform Fee',
    content = 'Shopyos charges a 2.5% Driver Platform Fee on your delivery earnings, automatically deducted before payout. You receive 97.5% of the delivery fee for each completed delivery.',
    version = '2.0'
WHERE type = 'driver_earnings';

INSERT INTO platform_disclaimers (type, version, title, content) VALUES
('parcel_hub_earnings', '1.0', 'Parcel Hub Earnings & Platform Fee', 'Shopyos charges a 2.5% Parcel Hub Platform Fee on your transit-fee earnings, automatically deducted before payout. You receive 97.5% of your hub''s share of the transit fee for each parcel handled.')
ON CONFLICT (type) DO NOTHING;
