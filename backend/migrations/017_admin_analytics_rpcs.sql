-- Migration 017: Admin Analytics RPCs
-- Exposes high-performance aggregation queries for the admin dashboard

CREATE OR REPLACE FUNCTION get_admin_order_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_orders', COUNT(id),
    'completed_orders', COUNT(id) FILTER (WHERE status = 'completed'),
    'pending_orders', COUNT(id) FILTER (WHERE status = 'pending'),
    'cancelled_orders', COUNT(id) FILTER (WHERE status = 'cancelled'),
    'total_revenue', COALESCE(SUM(total_amount) FILTER (WHERE status IN ('paid', 'confirmed', 'ready_for_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed')), 0)
  ) INTO v_stats
  FROM orders;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_admin_product_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_products', COUNT(p.id),
    'active_products', COUNT(p.id) FILTER (WHERE p.is_active = TRUE),
    'out_of_stock_products', COALESCE(SUM(CASE WHEN i.quantity <= 0 THEN 1 ELSE 0 END), 0)
  ) INTO v_stats
  FROM products p
  LEFT JOIN inventory i ON i.product_id = p.id
  WHERE p.deleted_at IS NULL;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_admin_review_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_reviews', COUNT(id),
    'average_rating', COALESCE(AVG(rating), 0)
  ) INTO v_stats
  FROM product_reviews;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql;
