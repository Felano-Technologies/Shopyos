-- 033: index parcel_status_log(updated_by) — three chat-contact queries filter
-- on it and were sequential-scanning as the log grows.
CREATE INDEX IF NOT EXISTS idx_parcel_status_log_updated_by ON parcel_status_log(updated_by);
