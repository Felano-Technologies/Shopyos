-- =====================================================
-- Shopyos Admin Features Migration
-- Migration 002 — Admin full-parity enhancements
-- =====================================================

-- -------------------------------------------------------
-- 1. Audit logs: add status + failure_reason columns
-- -------------------------------------------------------

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS status         VARCHAR(10) NOT NULL DEFAULT 'success'
    CONSTRAINT audit_logs_status_check CHECK (status IN ('success', 'failed')),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status, timestamp DESC);

-- -------------------------------------------------------
-- 2. Banner campaigns: flag for admin-created (no payment)
-- -------------------------------------------------------

ALTER TABLE banner_campaigns
  ADD COLUMN IF NOT EXISTS admin_created BOOLEAN NOT NULL DEFAULT FALSE;

-- -------------------------------------------------------
-- 3. Users: soft-delete column
-- -------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
