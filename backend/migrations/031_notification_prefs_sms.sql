-- 031: Add the SMS channel toggle the notification code has been gating on.
-- notificationService.sendNotification checks preferences.sms_enabled — the
-- column never existed, so SMS silently never sent for anyone.

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT TRUE;

-- Existing rows predate the column: enable SMS to match the intended default.
UPDATE notification_preferences SET sms_enabled = TRUE WHERE sms_enabled IS NULL;
