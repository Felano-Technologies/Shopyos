-- Migration 056: Backfill existing sellers into the unified verification model.
--
-- Must run BEFORE requireVerified('seller') is enforced on any live route —
-- otherwise every existing seller (who has no verification_applications row
-- yet) would suddenly be blocked from an action that was previously ungated.
-- Per plan §Existing-user migration: already-approved sellers keep full
-- access immediately (legacy_migrated=true, status='approved', every
-- required step pre-marked 'verified'); a 30-day grace period only matters
-- for whatever NEW requirements (consent, liveness) get added later that
-- these legacy rows never actually did.

DO $$
DECLARE
  seller_role_id UUID;
BEGIN
  -- One verification_applications row per store owner who doesn't already
  -- have an open seller application (idempotent re-run safe).
  INSERT INTO verification_applications (
    user_id, role, status, requirements_version, entity_id,
    legacy_migrated, verification_required_by, reviewed_at, submitted_at
  )
  SELECT
    s.owner_id,
    'seller',
    CASE
      WHEN s.is_verified = true OR s.verification_status = 'verified' THEN 'approved'
      WHEN s.verification_status = 'rejected' THEN 'rejected'
      ELSE 'under_review'
    END,
    1,
    s.id,
    true,
    NOW() + INTERVAL '30 days',
    CASE WHEN s.is_verified = true OR s.verification_status = 'verified' THEN COALESCE(s.verified_at, NOW()) END,
    s.created_at
  FROM stores s
  WHERE s.owner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM verification_applications va
      WHERE va.user_id = s.owner_id AND va.role = 'seller'
    );

  -- For every backfilled row that landed as 'approved', mark every required
  -- seller step 'verified' too — canActivateSeller() requires ALL required
  -- steps verified, not just application.status, so without this an approved
  -- legacy seller would still fail the new gate.
  INSERT INTO verification_steps (application_id, step_key, status, completed_at)
  SELECT va.id, step_key, 'verified', NOW()
  FROM verification_applications va
  CROSS JOIN unnest(ARRAY['personal_info','identity','liveness','business','shop_location','payout','training']) AS step_key
  WHERE va.role = 'seller' AND va.legacy_migrated = true AND va.status = 'approved'
  ON CONFLICT (application_id, step_key) DO NOTHING;
END $$;
