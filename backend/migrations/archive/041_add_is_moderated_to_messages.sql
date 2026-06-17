-- Migration: 041_add_is_moderated_to_messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_moderated BOOLEAN DEFAULT FALSE;
