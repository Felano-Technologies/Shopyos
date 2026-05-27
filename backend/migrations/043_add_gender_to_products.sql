-- Migration 043: Add Gender to Products Table
-- Date: May 27, 2026

-- Add gender column to products table with default 'Unisex'
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS gender VARCHAR(50) DEFAULT 'Unisex';

-- Add check constraint for valid genders
ALTER TABLE products
DROP CONSTRAINT IF EXISTS valid_gender;

ALTER TABLE products
ADD CONSTRAINT valid_gender CHECK (gender IN ('Men', 'Women', 'Unisex', 'Boys', 'Girls'));

-- Create index on products(gender) for fast filtering in search and discovery
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender) 
WHERE is_active = TRUE AND deleted_at IS NULL;
