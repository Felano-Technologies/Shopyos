-- Add read_at to notifications for read timestamp tracking
-- Safe to run multiple times

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
ON notifications(user_id, read_at)
WHERE read_at IS NOT NULL;
