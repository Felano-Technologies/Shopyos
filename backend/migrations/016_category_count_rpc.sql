-- Migration 016: Category Counts RPC
-- Returns category names with product counts efficiently for caching

CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(category VARCHAR, product_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.category, 
    COUNT(p.id) AS product_count
  FROM products p
  WHERE p.is_active = TRUE 
    AND p.deleted_at IS NULL
  GROUP BY p.category
  ORDER BY product_count DESC;
END;
$$ LANGUAGE plpgsql;
