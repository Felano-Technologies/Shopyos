-- Migration 045: Flash Sales
-- Creates flash_sales and flash_sale_products tables for real-time time-limited deals

CREATE TABLE IF NOT EXISTS flash_sales (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_sale_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS flash_sale_products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id  UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flash_price    DECIMAL(10,2) NOT NULL,
  stock_limit    INTEGER,          -- NULL = unlimited within sale
  sold_count     INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(flash_sale_id, product_id),
  CONSTRAINT positive_flash_price CHECK (flash_price > 0),
  CONSTRAINT valid_stock CHECK (stock_limit IS NULL OR stock_limit > 0)
);

-- Index for fast "get current active sale" query
CREATE INDEX IF NOT EXISTS idx_flash_sales_active_window
  ON flash_sales (is_active, starts_at, ends_at);

-- Index for product lookup within a sale
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_sale_id
  ON flash_sale_products (flash_sale_id);
