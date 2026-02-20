-- Add deleted_at column to review tables
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE store_reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE driver_reviews ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create store_follows table
CREATE TABLE IF NOT EXISTS store_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_store_follow UNIQUE (user_id, store_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_store_follows_user ON store_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_store_follows_store ON store_follows(store_id);
