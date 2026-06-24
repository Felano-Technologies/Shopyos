-- Support ticket system for all user roles

DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM (
    'order_issue', 'delivery_issue', 'product_issue', 'payment_issue',
    'driver_issue', 'parcel_partner_issue', 'platform_issue', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reporter_role AS ENUM ('buyer', 'seller', 'driver', 'parcel_partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_role reporter_role NOT NULL,
  category      ticket_category NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL,
  entity_type   VARCHAR(50),
  entity_id     UUID,
  status        ticket_status NOT NULL DEFAULT 'open',
  priority      SMALLINT NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  admin_notes   TEXT,
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_reporter ON support_tickets (reporter_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets (category);
