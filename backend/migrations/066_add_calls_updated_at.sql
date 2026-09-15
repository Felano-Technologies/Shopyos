-- Migration 066: add missing updated_at column to calls
--
-- BaseRepository.update() unconditionally sets `updated_at` on every update
-- (db/repositories/BaseRepository.js:150) — every other table has this
-- column, but calls (migration 052) never got one. That means every single
-- call to CallRepository.updateCall (accept/reject/end/missed-timeout) has
-- been failing with "column \"updated_at\" of relation \"calls\" does not
-- exist" (42703) since the call feature shipped — this is why tapping
-- Answer/Reject/End appeared to silently do nothing.

ALTER TABLE calls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
