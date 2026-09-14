-- Migration: 063_add_call_missed_notification_type
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'call_missed';
