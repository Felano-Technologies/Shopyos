-- Migration 019: Ensure bargain notification_type enum values exist
-- Migration 012 added these via ALTER TYPE, but 001_initial_schema.sql (the consolidated
-- baseline) was generated before migration 012 and omits them. Any env where the schema
-- was initialised fresh after that point will be missing these values, causing every
-- bargain notification INSERT to fail silently with
--   "invalid input value for enum notification_type: 'bargain_offer_received'"

DO $$
BEGIN
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_offer_received';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_countered';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_accepted';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'bargain_rejected';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;
