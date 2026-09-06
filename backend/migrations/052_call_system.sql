-- Migration 052: In-app calling — call ledger + recording metadata.
-- Replaces the old tel: dialer hand-off with in-app, recorded, admin-auditable
-- calls between buyer/seller/driver, scoped to the order they share.
--
-- Architecture: Agora RTC carries the live audio; the client records the
-- call locally and uploads the finished file to the app's own Railway
-- storage bucket afterward (see callController.js's uploadCallRecording) —
-- there is no Agora Cloud Recording vendor bucket involved.

CREATE TABLE IF NOT EXISTS calls (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID REFERENCES orders(id),        -- NULL for admin-initiated, unscoped calls
    caller_id           UUID NOT NULL REFERENCES users(id),
    receiver_id         UUID NOT NULL REFERENCES users(id),
    agora_channel_name  VARCHAR(128) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ringing'
                         CHECK (status IN ('ringing', 'accepted', 'rejected', 'missed', 'ended', 'failed')),
    started_at          TIMESTAMPTZ,                       -- server-stamped when accepted — never client-reported
    ended_at            TIMESTAMPTZ,                       -- server-stamped when ended
    duration_seconds    INT,                                -- server-computed from started_at/ended_at, never trusted from the client
    end_reason          VARCHAR(30),                       -- caller_hangup|receiver_hangup|timeout_30s|rejected|missed|error
    recording_status    VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (recording_status IN ('pending', 'available', 'failed', 'not_recorded')),
    recording_url       TEXT,                               -- storage key in the app's Railway bucket, resolved to a presigned URL on read
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calls_order ON calls(order_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver ON calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
