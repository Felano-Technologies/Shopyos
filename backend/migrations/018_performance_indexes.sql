-- Migration 018: Performance Indexes
-- Adds indexes to speed up slow queries identified during audit

-- Product search performance
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC) WHERE is_active = true AND deleted_at IS NULL;

-- Order performance
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Cart performance
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(cart_id, product_id);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_reviews_store ON store_reviews(store_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_reviews_buyer ON product_reviews(buyer_id, product_id) WHERE deleted_at IS NULL;

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);

-- Stores
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id, is_active);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
