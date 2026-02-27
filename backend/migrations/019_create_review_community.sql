-- Migration for Review Community features (Likes & Comments)
-- Using polymorphic relations to support product_reviews, store_reviews, and driver_reviews

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_type') THEN
        CREATE TYPE review_type AS ENUM ('product', 'store', 'driver');
    END IF;
END
$$;

-- Create review_likes table
CREATE TABLE IF NOT EXISTS review_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL,
    review_type review_type NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(review_id, review_type, user_id)
);

CREATE INDEX idx_review_likes_review ON review_likes(review_id, review_type);

-- Create review_comments table
CREATE TABLE IF NOT EXISTS review_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL,
    review_type review_type NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_comments_review ON review_comments(review_id, review_type);

-- Add likes and comments counters to existing review tables
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

ALTER TABLE store_reviews ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE store_reviews ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

ALTER TABLE driver_reviews ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE driver_reviews ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- Function to increment review likes
CREATE OR REPLACE FUNCTION increment_review_likes(target_review_id UUID, target_type review_type)
RETURNS VOID AS $$
BEGIN
    IF target_type = 'product' THEN
        UPDATE product_reviews SET likes_count = likes_count + 1 WHERE id = target_review_id;
    ELSIF target_type = 'store' THEN
        UPDATE store_reviews SET likes_count = likes_count + 1 WHERE id = target_review_id;
    ELSIF target_type = 'driver' THEN
        UPDATE driver_reviews SET likes_count = likes_count + 1 WHERE id = target_review_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement review likes
CREATE OR REPLACE FUNCTION decrement_review_likes(target_review_id UUID, target_type review_type)
RETURNS VOID AS $$
BEGIN
    IF target_type = 'product' THEN
        UPDATE product_reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_review_id;
    ELSIF target_type = 'store' THEN
        UPDATE store_reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_review_id;
    ELSIF target_type = 'driver' THEN
        UPDATE driver_reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_review_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
