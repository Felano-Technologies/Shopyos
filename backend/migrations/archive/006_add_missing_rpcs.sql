-- Drop existing functions to allow parameter name changes
DROP FUNCTION IF EXISTS increment_product_views(UUID);
DROP FUNCTION IF EXISTS increment_product_sales(UUID, INT);

-- Recreate functions with consistent parameter names
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET view_count = view_count + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_product_sales(product_id UUID, sale_qty INT)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET total_sales = total_sales + sale_qty
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;
