-- Migration 009: Add missing notification_type enum values
-- The notification_type enum is missing values used by the order and delivery controllers
-- Run this in your Supabase SQL Editor

-- Add all notification types used throughout the codebase
-- Using IF NOT EXISTS pattern: try to add, ignore if already exists

DO $$
BEGIN
  -- Order-related types
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_placed';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_order';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_update';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_picked_up';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_delivered';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_confirmed';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_preparing';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_ready_for_pickup';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_cancelled';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_completed';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Payment types
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_success';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Delivery types
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_update';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_assigned';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_in_transit';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'delivery_issue';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Messaging types
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_message';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Review types
  BEGIN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_review';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;
