-- Migration 059: Post-approval vehicle change requests (Phase 3).
-- Mirrors 057_shop_location_changes.sql — an approved driver can't silently
-- swap their verified vehicle; adding a new one goes through its own
-- lightweight review while the driver's current verified vehicle stays
-- active/operational until the new one is verified. Documents for a vehicle
-- change attach via the existing verification_documents table with
-- parent_type='vehicle_change'.

CREATE TABLE IF NOT EXISTS driver_vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id UUID NOT NULL REFERENCES driver_profiles(id),
  vehicle_type      VARCHAR(20),
  make              VARCHAR(50),
  model             VARCHAR(50),
  year              INT,
  colour            VARCHAR(30),
  plate_number      VARCHAR(20),
  relationship      VARCHAR(20) NOT NULL CHECK (relationship IN ('owner', 'authorized_user', 'employer_owned')),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  is_active         BOOLEAN NOT NULL DEFAULT false,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES users(id),
  rejection_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_drivervehicle_profile ON driver_vehicles(driver_profile_id);
