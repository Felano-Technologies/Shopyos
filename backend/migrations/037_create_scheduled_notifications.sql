-- Migration 037: Scheduled broadcast notifications table
-- Supports manual admin schedules, automated holiday campaigns, and daily engagement pushes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scheduled_notification_status') THEN
    CREATE TYPE scheduled_notification_status AS ENUM ('pending', 'processing', 'sent', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_recipient_type') THEN
    CREATE TYPE notification_recipient_type AS ENUM ('all', 'stores', 'drivers', 'customers', 'specific');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_campaign_type') THEN
    CREATE TYPE notification_campaign_type AS ENUM ('manual', 'holiday', 'daily_engagement');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(255)                       NOT NULL,
  message          TEXT                               NOT NULL,

  -- Delivery channels
  send_email       BOOLEAN                            NOT NULL DEFAULT FALSE,
  send_sms         BOOLEAN                            NOT NULL DEFAULT FALSE,
  send_push        BOOLEAN                            NOT NULL DEFAULT TRUE,

  -- Targeting
  recipient_type   notification_recipient_type        NOT NULL DEFAULT 'all',
  recipient_ids    UUID[]                             DEFAULT NULL,

  -- Campaign classification
  campaign_type    notification_campaign_type         NOT NULL DEFAULT 'manual',

  -- Lifecycle
  scheduled_at     TIMESTAMPTZ                        NOT NULL,
  status           scheduled_notification_status      NOT NULL DEFAULT 'pending',
  error_message    TEXT                               DEFAULT NULL,
  sent_at          TIMESTAMPTZ                        DEFAULT NULL,

  -- Audit
  created_by       UUID                               DEFAULT NULL,
  created_at       TIMESTAMPTZ                        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ                        NOT NULL DEFAULT NOW()
);

-- Worker poll index: filters by status + time in every cron tick
CREATE INDEX IF NOT EXISTS idx_sched_notif_status_at
  ON scheduled_notifications (status, scheduled_at);
