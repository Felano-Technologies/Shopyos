-- Migration 055: Unified KYC/Verification/Onboarding system (Phase 1 — Foundation)
--
-- Replaces the scattered verification columns bolted onto `stores` and
-- `driver_profiles` with a normalized, role-agnostic model:
--   verification_applications -> verification_steps -> verification_documents
-- plus liveness attempts, consent capture, and admin communication log.
-- `stores`/`driver_profiles` remain the *operational* source of truth (what's
-- shown on a delivery/store page); these new tables are the verification
-- *state*. Existing seller/driver data backfills into this model in later
-- migrations (Phase 2/3), not here.

-- Extend the existing role vocabulary with admin sub-roles (permission tiers
-- for the verification console) — plain 'admin' remains a superset/"super
-- admin" that satisfies every check.
ALTER TABLE roles DROP CONSTRAINT IF EXISTS valid_role_name;
ALTER TABLE roles ADD CONSTRAINT valid_role_name CHECK (name IN (
  'buyer', 'seller', 'driver', 'admin', 'parcel_partner',
  'verification_admin', 'support_admin', 'finance_admin', 'operations_admin'
));
INSERT INTO roles (name, display_name, description) VALUES
  ('verification_admin', 'Verification Admin', 'Reviews and approves/rejects seller & driver verification applications, including identity/liveness documents'),
  ('support_admin', 'Support Admin', 'Handles applicant communication and requests-for-information; cannot view identity documents or approve/reject'),
  ('finance_admin', 'Finance Admin', 'Views payout/financial verification details only'),
  ('operations_admin', 'Operations Admin', 'General operational admin access')
ON CONFLICT (name) DO NOTHING;

-- One row per role-application. A user can hold independent applications per
-- role at once (approved seller + pending driver is valid) — the partial
-- unique index scopes "one open application" to (user, role), not (user).
CREATE TABLE IF NOT EXISTS verification_applications (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id),
  role                      VARCHAR(20) NOT NULL CHECK (role IN ('seller', 'driver')),
  status                    VARCHAR(20) NOT NULL DEFAULT 'draft'
                             CHECK (status IN (
                               'draft', 'in_progress', 'submitted', 'under_review',
                               'action_required', 'resubmitted', 'approved', 'rejected', 'suspended'
                             )),
  requirements_version      INT NOT NULL DEFAULT 1, -- pins this application to the step set active when it was created
  entity_id                 UUID,                    -- store_id or driver_profiles.id, once the underlying entity exists
  risk_score                INT NOT NULL DEFAULT 0,  -- column exists from day one; scoring logic itself is Phase 5
  risk_level                VARCHAR(10) NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  legacy_migrated           BOOLEAN NOT NULL DEFAULT false, -- true for backfilled pre-existing approved sellers/drivers
  verification_required_by DATE,                     -- grace-period deadline for legacy_migrated rows
  submitted_at              TIMESTAMPTZ,
  reviewed_at               TIMESTAMPTZ,
  reviewed_by               UUID REFERENCES users(id),
  rejection_reason          TEXT,
  resubmission_allowed      BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verapp_user_role_open ON verification_applications(user_id, role)
  WHERE status NOT IN ('rejected', 'suspended');
CREATE INDEX IF NOT EXISTS idx_verapp_status ON verification_applications(status);
CREATE INDEX IF NOT EXISTS idx_verapp_role ON verification_applications(role);

-- One row per required step (identity, liveness, business, shop, payout,
-- training, ... per role, per requirements_version).
CREATE TABLE IF NOT EXISTS verification_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
  step_key       VARCHAR(40) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started', 'in_progress', 'complete', 'verified', 'action_required', 'rejected')),
  match_status   VARCHAR(20) CHECK (match_status IN ('match', 'partial_match', 'mismatch', 'unable_to_verify')),
  data           JSONB NOT NULL DEFAULT '{}', -- step's own form fields (training keeps {version, acknowledged:[...]} here; liveness keeps attempt counters here)
  completed_at   TIMESTAMPTZ,
  UNIQUE(application_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_versteps_app ON verification_steps(application_id);

-- Documents. `parent_type`/`parent_id` (not a hard application_id FK) so this
-- same table also backs post-approval change workflows added in Phase 2/3
-- (vehicle swap, shop relocation) without a second documents table.
CREATE TABLE IF NOT EXISTS verification_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type          VARCHAR(30) NOT NULL CHECK (parent_type IN ('application', 'vehicle_change', 'shop_location_change')),
  parent_id            UUID NOT NULL,
  step_key             VARCHAR(40) NOT NULL,
  document_type        VARCHAR(40) NOT NULL,
  storage_key          TEXT NOT NULL, -- private object key; resolved server-side only via a short-lived signed URL, never a public URL
  status               VARCHAR(20) NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('not_submitted', 'submitted', 'processing', 'verified', 'rejected', 'requires_reupload', 'expired')),
  verification_method  VARCHAR(20) CHECK (verification_method IN ('automated', 'admin', 'external_provider', 'system')),
  provider_reference   TEXT,
  expires_at           DATE,
  rejection_reason     TEXT,
  previous_document_id UUID REFERENCES verification_documents(id), -- version chain: a reupload points at what it replaced; old row is kept, not deleted
  deleted_at           TIMESTAMPTZ, -- soft-delete for retention-policy enforcement
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at          TIMESTAMPTZ,
  reviewed_by          UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_verdoc_parent ON verification_documents(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_verdoc_expiry ON verification_documents(expires_at) WHERE expires_at IS NOT NULL;

-- Liveness: every attempt kept (not just the last), explicitly framed as
-- evidence for admin review, not a verdict — `passed` is the on-device claim
-- only. The owning step can reach 'complete' from a passing attempt, but only
-- an admin looking at captured_frame_key can move it to 'verified'.
CREATE TABLE IF NOT EXISTS liveness_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
  attempt_number      INT NOT NULL,
  passed              BOOLEAN NOT NULL,
  challenge_sequence  VARCHAR(100),
  anti_spoof_score    NUMERIC(4,3),
  captured_frame_key  TEXT, -- private storage key, same access rules as verification_documents
  method_version      VARCHAR(20) NOT NULL,
  device_info         TEXT,
  app_version         VARCHAR(20),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liveness_app ON liveness_verifications(application_id);

-- One-time consent capture, required before identity/liveness collection begins.
CREATE TABLE IF NOT EXISTS verification_consents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
  consent_version  INT NOT NULL,
  consented_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verconsent_app ON verification_consents(application_id);

-- Admin communication log, with delivery status so a failed SMS/email isn't
-- silently mistaken for a sent one.
CREATE TABLE IF NOT EXISTS verification_communications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       UUID NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
  admin_id             UUID REFERENCES users(id),
  channel              VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'sms', 'phone_call')),
  direction            VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound', 'internal_note')),
  message              TEXT,
  delivery_status      VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'retrying')),
  provider_message_id  TEXT,
  failure_reason       TEXT,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vercomm_app ON verification_communications(application_id);
