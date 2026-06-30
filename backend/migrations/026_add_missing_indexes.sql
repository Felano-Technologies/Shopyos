-- Migration 026: Add Missing Database Indexes
-- Target frequently queried columns that lack indexes for performance

-- Favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Promo codes
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_upper ON promo_codes(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_code_user ON promo_code_uses(code_id, user_id);

-- Product images
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Cart
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_product ON cart_items(cart_id, product_id);

-- User events (recommendations)
CREATE INDEX IF NOT EXISTS idx_user_events_user_product ON user_events(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);

-- Returns
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);

-- Wallet & balance logs
CREATE INDEX IF NOT EXISTS idx_wallet_logs_user_type ON wallet_logs(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_balance_logs_store ON balance_logs(store_id);

-- Notification logs (idempotency)
CREATE INDEX IF NOT EXISTS idx_notification_logs_event ON notification_logs(event_type, target, reference_id);

-- Full-text search index for products (GIN tsvector)
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))
);
