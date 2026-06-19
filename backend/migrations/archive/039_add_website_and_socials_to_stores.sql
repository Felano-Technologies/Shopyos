-- Migration: 039_add_website_and_socials_to_stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS social_instagram TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS social_facebook TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
