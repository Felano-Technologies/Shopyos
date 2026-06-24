-- Extend cart_items to track bargained price
ALTER TABLE cart_items
    ADD COLUMN IF NOT EXISTS bargain_offer_id   UUID REFERENCES bargain_offers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bargain_discount    DECIMAL(10,2) DEFAULT 0;
