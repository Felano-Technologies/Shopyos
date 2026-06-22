-- Add bargaining columns to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS bargaining_enabled  BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS min_bargain_price   DECIMAL(10,2);

-- Create bargain_status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bargain_status') THEN
        CREATE TYPE bargain_status AS ENUM (
            'pending', 'countered', 'accepted', 'rejected',
            'expired', 'withdrawn', 'checked_out'
        );
    END IF;
END$$;

-- Create bargain_offers table
CREATE TABLE IF NOT EXISTS bargain_offers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id            UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    original_price      DECIMAL(10,2) NOT NULL,
    offered_price       DECIMAL(10,2) NOT NULL,
    counter_price       DECIMAL(10,2),
    final_agreed_price  DECIMAL(10,2),
    bargain_discount    DECIMAL(10,2) DEFAULT 0,  -- original_price - final_agreed_price
    status              bargain_status NOT NULL DEFAULT 'pending',
    round_number        INTEGER NOT NULL DEFAULT 1,
    max_rounds          INTEGER NOT NULL DEFAULT 3,  -- read from feeConfig on creation
    buyer_message       TEXT,
    seller_message      TEXT,
    expires_at          TIMESTAMPTZ NOT NULL,
    accepted_at         TIMESTAMPTZ,
    checkout_window_end TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_offered_price CHECK (offered_price > 0),
    CONSTRAINT valid_round_number  CHECK (round_number BETWEEN 1 AND 10)
);

-- Create bargain_history table (for audit trail)
CREATE TABLE IF NOT EXISTS bargain_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bargain_id  UUID NOT NULL REFERENCES bargain_offers(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES users(id),
    actor_role  VARCHAR(20) NOT NULL,
    action      VARCHAR(30) NOT NULL,
    price       DECIMAL(10,2),
    message     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bargain_offers_product  ON bargain_offers(product_id, status);
CREATE INDEX IF NOT EXISTS idx_bargain_offers_buyer    ON bargain_offers(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_bargain_offers_seller   ON bargain_offers(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_bargain_offers_expires  ON bargain_offers(expires_at) WHERE status IN ('pending','countered');
CREATE INDEX IF NOT EXISTS idx_bargain_history_bargain ON bargain_history(bargain_id, created_at DESC);

-- Extend order_items to track bargained price
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS bargain_offer_id   UUID REFERENCES bargain_offers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bargain_discount    DECIMAL(10,2) DEFAULT 0;

-- Extend orders to track total bargain discount
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS bargain_discount    DECIMAL(10,2) DEFAULT 0;

-- Add notifications enum/types for bargaining events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_offer_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_countered';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_rejected';
