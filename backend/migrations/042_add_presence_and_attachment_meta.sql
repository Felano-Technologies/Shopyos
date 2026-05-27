-- Migration: 042_add_presence_and_attachment_meta
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_meta JSONB;
