-- Seller identity verification: Ghana Card for the business owner
ALTER TABLE stores
    ADD COLUMN IF NOT EXISTS ghana_card_url TEXT;
