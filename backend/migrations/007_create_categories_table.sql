-- =====================================================
-- Migration 007: Categories Management
-- =====================================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for categories
CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Seed with initial default categories
INSERT INTO categories (name, slug, description, is_active) VALUES
('Electronics', 'electronics', 'Devices, gadgets, and accessories', TRUE),
('Fashion', 'fashion', 'Clothing, shoes, and jewelry', TRUE),
('Home & Kitchen', 'home-kitchen', 'Furniture, appliances, and decor', TRUE),
('Beauty', 'beauty', 'Makeup, skincare, and fragrance', TRUE),
('Sports', 'sports', 'Gear, apparel, and equipment', TRUE),
('Books', 'books', 'Books, textbooks, and magazines', TRUE),
('Toys', 'toys', 'Games, puzzles, and toys', TRUE),
('Health', 'health', 'Supplements, first aid, and wellness', TRUE),
('Automotive', 'automotive', 'Parts, accessories, and tools', TRUE),
('Grocery', 'grocery', 'Food, beverages, and household staples', TRUE),
('Art', 'art', 'Paintings, sculptures, and crafts', TRUE),
('Other', 'other', 'Miscellaneous items', TRUE);

-- =====================================================
-- Function to sync product categories (optional check)
-- =====================================================
-- This ensures products that reference a category name are matched to this table if we enforce FK later.
-- For now, the products table uses a VARCHAR 'category' column which stores the name directly.
