-- =====================================================
-- Shopyos E-commerce Platform
-- Migration 004: Fix Schema Gaps (Orders, Messages, Deliveries)
-- =====================================================

-- 1. ORDERS TABLE UPDATES
-- Adding missing columns expected by OrderController and OrderRepository
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
-- Code uses 'delivery_address' generic field, while schema had specific address lines.
-- Adding generic field to support current code implementation.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- 2. MESSAGES TABLE UPDATES
-- Adding types and attachments support for rich messaging
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 3. DELIVERIES TABLE UPDATES
-- Adding time estimation fields and fixing fee constraint
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estimated_pickup_time TIMESTAMPTZ;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;

-- Make delivery_fee nullable or default to 0 since it might be calculated later
ALTER TABLE deliveries ALTER COLUMN delivery_fee DROP NOT NULL;
ALTER TABLE deliveries ALTER COLUMN delivery_fee SET DEFAULT 0;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
