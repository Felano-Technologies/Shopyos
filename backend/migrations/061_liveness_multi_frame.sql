-- Migration 061: Multi-frame liveness capture.
-- The original single captured_frame_key can't support real (future)
-- server-side liveness/anti-spoof analysis, which needs to compare frames
-- across the challenge sequence (e.g. head-yaw delta between a baseline
-- frame and a "turn left" frame). `frames` holds every captured frame as
-- [{label, storageKey}] — `captured_frame_key` is kept for backward
-- compatibility with any already-recorded single-frame attempts and now
-- just mirrors the last frame captured.
ALTER TABLE liveness_verifications
  ADD COLUMN IF NOT EXISTS frames JSONB NOT NULL DEFAULT '[]';
