-- Add updated_at to notification_logs to track when status last changed
-- (e.g. PROCESSING -> SENT or PROCESSING -> FAILED)

ALTER TABLE notification_logs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
