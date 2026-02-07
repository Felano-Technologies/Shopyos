-- =====================================================
-- Shopyos E-commerce Platform
-- PostgreSQL Schema for Supabase
-- Migration 002: Add Favorites Table
-- Date: February 6, 2026
-- =====================================================

-- =====================================================
-- FAVORITES/WISHLIST DOMAIN
-- =====================================================

-- Create favorites table for user wishlists
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user can only favorite a product once
    CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);

-- Indexes for favorites
CREATE INDEX idx_favorites_user_id ON favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_product_id ON favorites(product_id);
CREATE INDEX idx_favorites_created_at ON favorites(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on favorites table
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
    ON favorites
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can add their own favorites
CREATE POLICY "Users can add their own favorites"
    ON favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
    ON favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE favorites IS 'User product favorites/wishlist';
COMMENT ON COLUMN favorites.user_id IS 'User who favorited the product';
COMMENT ON COLUMN favorites.product_id IS 'Product that was favorited';
COMMENT ON COLUMN favorites.created_at IS 'When the product was added to favorites';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
