-- =====================================================
-- Shopyos Platform Settings
-- Migration 003 — Persistent admin platform settings
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_mode     BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_approve_sellers BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed one default row (singleton pattern — always exactly one row)
INSERT INTO platform_settings (maintenance_mode, auto_approve_sellers)
SELECT FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);
