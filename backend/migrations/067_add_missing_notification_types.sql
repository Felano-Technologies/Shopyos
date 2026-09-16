-- Migration 067: add notification_type enum values that were used in code
-- (approveApplication/rejectApplication, admin approve/reject-driver-or-
-- business flows, payout release, account deletion) but never added to the
-- enum itself. notificationService.sendNotification()'s outer try/catch
-- swallows the resulting "invalid input value for enum notification_type"
-- error silently (logs it, returns false) — so every one of these has been
-- creating NO notification row, NO push, and NO real-time socket emit at
-- all, with no visible error anywhere in the app.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'business_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'business_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'driver_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'driver_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_submitted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_action_required';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payout_released';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_deletion_requested';
