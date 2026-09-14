-- Migration: 064_add_voip_push_tokens
-- Separate from expo_push_tokens: these are raw native tokens (APNs VoIP
-- device token / FCM registration token), not Expo push tokens — Expo's
-- push relay doesn't support PushKit VoIP topics or guaranteed-wake
-- high-priority data messages, so calls send through this table directly
-- via node-apn/firebase-admin instead of expo-server-sdk.
CREATE TABLE IF NOT EXISTS voip_push_tokens (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform     VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    token        VARCHAR(512) NOT NULL UNIQUE,
    device_name  VARCHAR(255),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voip_push_tokens_user ON voip_push_tokens(user_id);
