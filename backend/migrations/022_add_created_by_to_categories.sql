-- =====================================================
-- Migration 022: Add created_by column to categories
-- =====================================================

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
