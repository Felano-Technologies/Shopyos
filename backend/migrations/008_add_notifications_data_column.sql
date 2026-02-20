-- Migration 008: Add missing 'data' column to notifications table
-- This column stores additional metadata for notifications (e.g., orderId, orderNumber, amounts)
-- Run this in your Supabase SQL Editor

-- Add the 'data' JSONB column to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN notifications.data IS 'Additional metadata for the notification (e.g., orderId, orderNumber, amounts)';
