-- Migration 043: promo_codes needs an updated_at column so the generic
-- BaseRepository.update() (used to deactivate a code) has somewhere to stamp.

ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
