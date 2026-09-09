-- Migration 058: Backfill existing drivers into the unified verification model.
-- Mirrors 056_verification_backfill_sellers.sql's approach for drivers.
-- driver_profiles has no verification_status text column (just is_verified
-- boolean + a nullable rejection_reason) — infer rejected from a non-null
-- rejection_reason on an unverified row, everything else unverified maps to
-- under_review so it can be completed/reviewed under the new system.

DO $$
BEGIN
  INSERT INTO verification_applications (
    user_id, role, status, requirements_version, entity_id,
    legacy_migrated, verification_required_by, reviewed_at, submitted_at
  )
  SELECT
    dp.user_id,
    'driver',
    CASE
      WHEN dp.is_verified = true THEN 'approved'
      WHEN dp.is_verified = false AND dp.rejection_reason IS NOT NULL THEN 'rejected'
      ELSE 'under_review'
    END,
    1,
    dp.id,
    true,
    NOW() + INTERVAL '30 days',
    CASE WHEN dp.is_verified = true THEN dp.updated_at END,
    dp.created_at
  FROM driver_profiles dp
  WHERE dp.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM verification_applications va
      WHERE va.user_id = dp.user_id AND va.role = 'driver'
    );

  INSERT INTO verification_steps (application_id, step_key, status, completed_at)
  SELECT va.id, step_key, 'verified', NOW()
  FROM verification_applications va
  CROSS JOIN unnest(ARRAY['personal_info','identity','liveness','driver_licence','vehicle','vehicle_docs','operating_location','emergency_contact','training']) AS step_key
  WHERE va.role = 'driver' AND va.legacy_migrated = true AND va.status = 'approved'
  ON CONFLICT (application_id, step_key) DO NOTHING;
END $$;
