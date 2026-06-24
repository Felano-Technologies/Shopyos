-- 016_password_reset_required.sql
-- Admin-created accounts must reset password on first login.
-- Also relax NOT NULL constraints on driver_profiles so admins can create
-- skeleton profiles that the driver completes themselves.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE driver_profiles
  ALTER COLUMN vehicle_type DROP NOT NULL,
  ALTER COLUMN license_plate DROP NOT NULL,
  ALTER COLUMN drivers_license_number DROP NOT NULL,
  ALTER COLUMN license_expiry_date DROP NOT NULL;
