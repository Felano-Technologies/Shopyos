-- Migration 047: Add notification_type enum values for new features
-- Covers: abandoned cart, loyalty, returns, price drops, waitlist, review responses, badges

DO $$
BEGIN
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'cart_abandonment';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'price_drop';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'back_in_stock';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'return_requested';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'return_approved';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'return_declined';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'refund_issued';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'seller_review_response';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'loyalty_earned';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'badge_awarded';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;
