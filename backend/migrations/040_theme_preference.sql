-- Migration 040: Per-user theme preference (light/dark/system), synced across devices.

ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'system';

DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_theme_preference_check
        CHECK (theme_preference IN ('light', 'dark', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
