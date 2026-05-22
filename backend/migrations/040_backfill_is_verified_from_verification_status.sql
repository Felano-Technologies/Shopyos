-- Migration 040: Backfill is_verified from verification_status
-- ------------------------------------------------------------
-- The is_verified boolean column was intended to mirror
-- verification_status = 'verified', but a race condition in
-- verifyStore() could leave them out of sync (status updated,
-- boolean not written). This migration backfills any existing
-- rows so both columns agree.

UPDATE stores
SET
  is_verified  = (verification_status = 'verified'),
  is_trusted   = CASE
                   WHEN verification_status = 'verified'
                        AND (
                          business_cert_url    IS NOT NULL OR
                          business_license_url IS NOT NULL OR
                          proof_of_bank_url    IS NOT NULL
                        )
                   THEN TRUE
                   ELSE is_trusted   -- leave the existing value unchanged
                 END,
  updated_at   = NOW()
WHERE is_verified != (verification_status = 'verified');
