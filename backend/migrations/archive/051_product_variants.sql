-- Migration 051: Product variants (size / colour / material)
-- Variants are optional — products without rows in product_variants behave
-- exactly as before using products.stock_quantity.

CREATE TABLE IF NOT EXISTS product_variants (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku              TEXT,
  attributes       JSONB       NOT NULL DEFAULT '{}',  -- e.g. {"color":"Blue","size":"XL"}
  price            NUMERIC(10,2),   -- NULL = inherit base product price
  compare_at_price NUMERIC(10,2),
  stock_quantity   INTEGER     NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url        TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per attribute option per product — drives the frontend selector UI
CREATE TABLE IF NOT EXISTS product_variant_options (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_name    TEXT    NOT NULL,      -- e.g. 'color', 'size'
  option_values  TEXT[]  NOT NULL,      -- e.g. ARRAY['Red','Blue','Green']
  display_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, option_name)
);

-- Cart items need to reference a variant when the product has variants
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

-- Order items should also record which variant was purchased
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_attributes JSONB;

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants (product_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku
  ON product_variants (sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_variant_options_product
  ON product_variant_options (product_id);
