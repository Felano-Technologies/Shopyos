-- Migration 054: notification_type enum values for the replacement flow

DO $$
BEGIN
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'replacement_requested';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'replacement_approved';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'replacement_declined';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'replacement_shipped';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'replacement_delivered';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
