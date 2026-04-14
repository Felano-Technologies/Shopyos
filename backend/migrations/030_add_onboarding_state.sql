-- Migration 030: Add onboarding_state to user_profiles
-- This stores the individual onboarding completion status for different screens/features.
-- Format: { "home": true, "search": false, ... }

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_state JSONB DEFAULT '{}'::jsonb;

UPDATE user_profiles
SET onboarding_state = '{}'::jsonb
WHERE onboarding_state IS NULL;
