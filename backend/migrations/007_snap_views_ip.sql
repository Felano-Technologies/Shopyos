-- Migration to make snap_views unique by user_id or guest ip_address
ALTER TABLE snap_views DROP CONSTRAINT IF EXISTS snap_views_pkey;
ALTER TABLE snap_views ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE snap_views ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Create partial unique indexes to support unique view tracking
DROP INDEX IF EXISTS idx_snap_views_user_unique;
CREATE UNIQUE INDEX idx_snap_views_user_unique ON snap_views(snap_id, user_id) WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS idx_snap_views_ip_unique;
CREATE UNIQUE INDEX idx_snap_views_ip_unique ON snap_views(snap_id, ip_address) WHERE user_id IS NULL;
