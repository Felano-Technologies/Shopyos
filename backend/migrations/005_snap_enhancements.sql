-- Add expiration_notified column to snaps table
ALTER TABLE snaps 
ADD COLUMN IF NOT EXISTS expiration_notified BOOLEAN DEFAULT FALSE;

-- Create an index to make the sweep query faster
CREATE INDEX IF NOT EXISTS idx_snaps_expiration_sweep ON snaps(expires_at, expiration_notified);
