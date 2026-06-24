-- Flash sale time slots (admin-created schedule)
CREATE TABLE IF NOT EXISTS flash_sale_slots (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(255) NOT NULL,          -- "Morning Flash Sale", "Midnight Madness"
    start_time  TIMESTAMPTZ NOT NULL,
    end_time    TIMESTAMPTZ NOT NULL,
    max_items   INTEGER NOT NULL DEFAULT 10,    -- max products in this slot
    is_active   BOOLEAN DEFAULT TRUE,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_slot_times CHECK (end_time > start_time)
);

-- Extend flash_sales to link to stores and slots
ALTER TABLE flash_sales
    ADD COLUMN IF NOT EXISTS store_id    UUID REFERENCES stores(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS slot_id     UUID REFERENCES flash_sale_slots(id),
    ADD COLUMN IF NOT EXISTS status      VARCHAR(30) DEFAULT 'pending_approval',
    -- statuses: 'pending_approval', 'approved', 'rejected', 'live', 'ended', 'cancelled'
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Add store_id to flash_sale_products for easier querying
ALTER TABLE flash_sale_products
    ADD COLUMN IF NOT EXISTS store_id           UUID REFERENCES stores(id),
    ADD COLUMN IF NOT EXISTS reserved_quantity  INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sold_count         INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_flash_sales_store  ON flash_sales(store_id);
CREATE INDEX IF NOT EXISTS idx_flash_sales_status ON flash_sales(status);
CREATE INDEX IF NOT EXISTS idx_flash_sales_slot   ON flash_sales(slot_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_slots_time ON flash_sale_slots(start_time, end_time);
