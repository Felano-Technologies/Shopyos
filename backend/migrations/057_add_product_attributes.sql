-- Add product-level attributes JSONB column for material, style, connectivity etc.
-- Variant-split attributes (color, size) continue to live in product_variant_options.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';

-- GIN index for fast JSONB containment queries (@>)
CREATE INDEX IF NOT EXISTS idx_products_attributes
  ON products USING GIN(attributes)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- GIN index on variant option_values array for fast ANY() lookups
CREATE INDEX IF NOT EXISTS idx_variant_options_values
  ON product_variant_options USING GIN(option_values);
