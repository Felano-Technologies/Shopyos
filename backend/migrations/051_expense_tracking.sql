-- Migration 051: Expense tracking for the admin Financial Dashboard (P&L).
-- Revenue side already exists (orders.platform_fee/buyer_protection_fee,
-- banner_campaigns, promoted_products, deliveries — see getRevenueBreakdown
-- in adminController.js). This adds the missing expense side: admin-
-- configurable categories + logged expense entries.

CREATE TABLE IF NOT EXISTS expense_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurring expenses are stored once, not materialized as repeated rows —
-- the P&L query expands a recurring row virtually across whichever date
-- range is requested (bucketed by recurrence_frequency, capped at
-- recurrence_end_date or "today"). One row = one real recorded cost.
CREATE TABLE IF NOT EXISTS expenses (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id           UUID NOT NULL REFERENCES expense_categories(id),
    amount                DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    description           TEXT,
    expense_date          DATE NOT NULL,
    is_recurring          BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_frequency  VARCHAR(20) CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly') OR recurrence_frequency IS NULL),
    recurrence_end_date   DATE,
    created_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Starting operational-cost categories — fully editable/deactivatable by
-- admins afterwards from the Expense Categories screen.
INSERT INTO expense_categories (name, description) VALUES
('Payroll', 'Staff salaries and wages'),
('Hosting & Infrastructure', 'Servers, database, Redis, storage, CDN'),
('Marketing', 'Ads, promotions, campaigns'),
('Office & Operations', 'Rent, utilities, office supplies'),
('Payment Processing', 'Paystack/gateway transaction fees'),
('Software & Subscriptions', 'SaaS tools, licenses'),
('Legal & Compliance', 'Legal fees, licenses, audits'),
('Other', 'Uncategorized operational costs')
ON CONFLICT (name) DO NOTHING;
