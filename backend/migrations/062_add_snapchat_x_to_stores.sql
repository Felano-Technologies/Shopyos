-- Migration: 062_add_snapchat_x_to_stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS social_snapchat TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS social_x TEXT;
