-- Allow OAuth users who have no password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google account identifier for OAuth sign-in and account linking
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
