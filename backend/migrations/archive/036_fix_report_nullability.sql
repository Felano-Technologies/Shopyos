-- Migration 036: Fix report nullability to allow SET NULL on reporter deletion
-- reporter_id is currently NOT NULL but has ON DELETE SET NULL, which causes errors.
ALTER TABLE public.user_reports ALTER COLUMN reporter_id DROP NOT NULL;
