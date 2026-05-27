-- Migration 044: Add missing notification_type enum values
-- These types are used by the scheduler (admin_broadcast, holiday_celebration,
-- daily_engagement), verification flow (business_verification, driver_verification),
-- and order/delivery controllers (order_pending, order_paid, etc.) but were never
-- added to the enum — causing every related INSERT to fail silently.
--
-- Run in your Supabase SQL Editor or via the migration runner.

DO $$
BEGIN
  -- ── Scheduler broadcast types ─────────────────────────────────────────────
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_broadcast';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'holiday_celebration';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'daily_engagement';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- ── Verification types ────────────────────────────────────────────────────
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'business_verification';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'driver_verification';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- ── Order status types not covered by migration 009 ───────────────────────
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_pending';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_paid';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_payment_processing';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_assigned';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_in_transit';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_refunded';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_failed';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

END
$$;
