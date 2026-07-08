-- Migration 030: User security & privacy settings
--   - Two-factor authentication flag
--   - Login alert preference
--   - Account deletion requests
--   - Persistent privacy toggles (activity tracking, ads, etc.)
--   - login_alert notification type

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled   BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_alerts_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}'::jsonb;

DO $$ BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'login_alert';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
