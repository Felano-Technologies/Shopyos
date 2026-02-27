-- Migration for notification_logs for idempotency
-- Keeps track of successfully sent notifications to prevent duplicates (e.g., via retries)

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL, -- e.g., 'WELCOME_EMAIL', 'ORDER_CREATED_SMS'
    target VARCHAR(255) NOT NULL,    -- either email address or phone number
    reference_id UUID,               -- user_id or order_id
    status VARCHAR(50) NOT NULL,     -- 'SENT', 'FAILED'
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Idempotency key: ensure we don't send the same event to the same target for the same reference
    CONSTRAINT unique_notification UNIQUE(event_type, target, reference_id)
);

CREATE INDEX idx_notification_logs_lookup ON notification_logs(event_type, target, reference_id);
