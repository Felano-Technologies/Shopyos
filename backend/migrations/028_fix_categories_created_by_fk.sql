-- =====================================================
-- Migration 028: Fix Categories created_by FK
-- =====================================================
-- Migration 022 incorrectly referenced auth.users instead of public.users

-- 1. Drop the incorrect constraint
ALTER TABLE categories
DROP CONSTRAINT IF EXISTS categories_created_by_fkey;

-- 2. Add the correct constraint referencing our own users table
ALTER TABLE categories
ADD CONSTRAINT categories_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Comment for documentation
-- COMMENT ON COLUMN categories.created_by IS 'User and admin who created the category, referencing the public schema users table';
