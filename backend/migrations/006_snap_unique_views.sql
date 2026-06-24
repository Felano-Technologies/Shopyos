-- Create snap_views table for unique view tracking
CREATE TABLE IF NOT EXISTS snap_views (
    snap_id UUID NOT NULL REFERENCES snaps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (snap_id, user_id)
);

-- Add index on user_id for faster lookup
CREATE INDEX IF NOT EXISTS idx_snap_views_user_id ON snap_views(user_id);
