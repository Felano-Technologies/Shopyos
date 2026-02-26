-- Migration 013: Refresh Tokens Table
-- Supports secure token rotation, revocation, and multi-device session management

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,           -- SHA-256 hash of the actual token (never store raw)
  family_id UUID NOT NULL DEFAULT gen_random_uuid(), -- Token family for rotation detection
  device_info TEXT,                           -- User agent / device identifier
  ip_address INET,                           -- IP at time of creation
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,                       -- 'logout', 'rotation', 'compromised', 'admin'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replaced_by UUID REFERENCES refresh_tokens(id) -- Points to the token that replaced this one
);

-- Index for fast lookups by token hash (primary lookup path)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash) WHERE is_revoked = FALSE;

-- Index for finding all tokens for a user (logout-all, session management)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, is_revoked);

-- Index for token family (rotation fraud detection)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE is_revoked = FALSE;

-- Auto-cleanup function: remove expired tokens older than 30 days
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens
  WHERE expires_at < NOW() - INTERVAL '30 days'
  OR (is_revoked = TRUE AND revoked_at < NOW() - INTERVAL '7 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
