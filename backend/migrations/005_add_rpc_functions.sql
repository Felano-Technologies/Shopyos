-- =====================================================
-- Shopyos E-commerce Platform
-- Migration 005: Add RPC Functions and Fixes
-- =====================================================

-- 1. ADD RPC FUNCTIONS FOR ATOMIC INCREMENTS
-- Function to increment product view count atomically
CREATE OR REPLACE FUNCTION increment_product_views(product_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET view_count = view_count + 1
  WHERE id = product_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment product sales count atomically
CREATE OR REPLACE FUNCTION increment_product_sales(product_id_param UUID, sale_qty_param INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET 
    total_sales = total_sales + sale_qty_param
  WHERE id = product_id_param;
  
  -- Update store sales count too
  UPDATE stores
  SET total_sales = total_sales + sale_qty_param
  WHERE id = (SELECT store_id FROM products WHERE id = product_id_param);
END;
$$ LANGUAGE plpgsql;

-- Function to get store order statistics
CREATE OR REPLACE FUNCTION get_store_order_stats(
  store_id_param UUID,
  start_date_param TIMESTAMPTZ,
  end_date_param TIMESTAMPTZ
)
RETURNS TABLE (
  total_orders BIGINT,
  total_revenue DECIMAL,
  pending_orders BIGINT,
  completed_orders BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(total_amount), 0) AS total_revenue,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders
  FROM orders
  WHERE 
    store_id = store_id_param AND
    created_at BETWEEN start_date_param AND end_date_param;
END;
$$ LANGUAGE plpgsql;
