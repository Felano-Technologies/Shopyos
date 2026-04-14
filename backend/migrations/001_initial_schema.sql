-- =====================================================
-- Shopyos E-commerce Platform
-- PostgreSQL Schema for Supabase
-- Migration 001: Initial Schema Creation
-- Date: January 19, 2026
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USERS & AUTHENTICATION DOMAIN
-- =====================================================

-- Core user accounts (Supabase Auth integration)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- User profiles (one-to-one with users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- Indexes for user_profiles
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_location ON user_profiles(latitude, longitude) WHERE latitude IS NOT NULL;

-- =====================================================
-- 2. ROLES & PERMISSIONS DOMAIN
-- =====================================================

-- Predefined roles (buyer, seller, driver, admin)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_role_name CHECK (name IN ('buyer', 'seller', 'driver', 'admin'))
);

-- Many-to-many: users can have multiple roles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
);

-- Indexes for user_roles
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_active ON user_roles(user_id, is_active);

-- =====================================================
-- 3. STORES/BUSINESSES DOMAIN
-- =====================================================

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    category VARCHAR(100) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    featured_until TIMESTAMPTZ,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_average_rating CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT valid_total_reviews CHECK (total_reviews >= 0),
    CONSTRAINT valid_total_sales CHECK (total_sales >= 0),
    CONSTRAINT valid_store_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT valid_store_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- Indexes for stores
CREATE INDEX idx_stores_owner_id ON stores(owner_id);
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_name ON stores(store_name);
CREATE INDEX idx_stores_category ON stores(category) WHERE is_active = TRUE;
CREATE INDEX idx_stores_active ON stores(is_active);
CREATE INDEX idx_stores_featured ON stores(is_featured, featured_until) WHERE is_featured = TRUE;
CREATE INDEX idx_stores_location ON stores(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_stores_rating ON stores(average_rating DESC) WHERE is_active = TRUE;

-- =====================================================
-- 4. PRODUCTS DOMAIN
-- =====================================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    compare_at_price DECIMAL(10, 2),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    sku VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_promoted BOOLEAN DEFAULT FALSE,
    promoted_until TIMESTAMPTZ,
    promotion_budget DECIMAL(10, 2),
    promotion_impressions INTEGER DEFAULT 0,
    promotion_clicks INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    brand VARCHAR(100),
    weight_kg DECIMAL(10, 2),
    dimensions JSONB,
    tags JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_price CHECK (price > 0),
    CONSTRAINT valid_compare_price CHECK (compare_at_price IS NULL OR compare_at_price >= price),
    CONSTRAINT valid_product_rating CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT valid_promotion_budget CHECK (promotion_budget IS NULL OR promotion_budget >= 0),
    CONSTRAINT valid_counters CHECK (
        promotion_impressions >= 0 AND 
        promotion_clicks >= 0 AND 
        total_reviews >= 0 AND 
        total_sales >= 0 AND 
        view_count >= 0
    )
);

-- Indexes for products
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_title ON products(title) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products(category) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_products_active ON products(store_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_promoted ON products(is_promoted, promoted_until) WHERE is_promoted = TRUE;
CREATE INDEX idx_products_price ON products(price) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_products_rating ON products(average_rating DESC) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_products_created ON products(created_at DESC) WHERE is_active = TRUE AND deleted_at IS NULL;

-- Full-text search index for products
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', title || ' ' || description)) WHERE is_active = TRUE AND deleted_at IS NULL;

-- Product images (one-to-many)
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    alt_text VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_display_order CHECK (display_order >= 0)
);

-- Indexes for product_images
CREATE INDEX idx_product_images_product_id ON product_images(product_id, display_order);
CREATE INDEX idx_product_images_primary ON product_images(product_id) WHERE is_primary = TRUE;

-- =====================================================
-- 5. INVENTORY DOMAIN
-- =====================================================

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    track_inventory BOOLEAN DEFAULT TRUE,
    allow_backorder BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_quantities CHECK (
        quantity >= 0 AND 
        reserved_quantity >= 0 AND 
        reserved_quantity <= quantity AND
        low_stock_threshold >= 0
    )
);

-- Indexes for inventory
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_low_stock ON inventory(product_id) WHERE quantity <= low_stock_threshold;

-- =====================================================
-- 6. SHOPPING CART DOMAIN
-- =====================================================

CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for carts
CREATE INDEX idx_carts_user_id ON carts(user_id);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_add DECIMAL(10, 2) NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id),
    CONSTRAINT valid_cart_quantity CHECK (quantity > 0),
    CONSTRAINT valid_cart_price CHECK (price_at_add > 0)
);

-- Indexes for cart_items
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- =====================================================
-- 7. ORDERS DOMAIN
-- =====================================================

CREATE TYPE order_status AS ENUM (
    'pending',
    'payment_processing',
    'paid',
    'confirmed',
    'ready_for_pickup',
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'completed',
    'cancelled',
    'refunded'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'pending',
    subtotal DECIMAL(10, 2) NOT NULL,
    tax DECIMAL(10, 2) DEFAULT 0,
    delivery_fee DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    delivery_address_line1 VARCHAR(255) NOT NULL,
    delivery_address_line2 VARCHAR(255),
    delivery_city VARCHAR(100) NOT NULL,
    delivery_state_province VARCHAR(100),
    delivery_postal_code VARCHAR(20),
    delivery_country VARCHAR(100) NOT NULL,
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    buyer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    CONSTRAINT valid_order_amounts CHECK (
        subtotal >= 0 AND 
        tax >= 0 AND 
        delivery_fee >= 0 AND 
        total_amount = subtotal + tax + delivery_fee
    ),
    CONSTRAINT valid_delivery_latitude CHECK (delivery_latitude BETWEEN -90 AND 90),
    CONSTRAINT valid_delivery_longitude CHECK (delivery_longitude BETWEEN -180 AND 180)
);

-- Indexes for orders
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id, created_at DESC);
CREATE INDEX idx_orders_store_id ON orders(store_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_title VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT valid_order_item_price CHECK (price > 0),
    CONSTRAINT valid_order_item_subtotal CHECK (subtotal = quantity * price)
);

-- Indexes for order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- =====================================================
-- 8. PAYMENTS DOMAIN
-- =====================================================

CREATE TYPE payment_method AS ENUM ('card', 'mobile_money', 'bank_transfer');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_method payment_method NOT NULL,
    payment_provider VARCHAR(50),
    provider_transaction_id VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status payment_status NOT NULL DEFAULT 'pending',
    payment_details JSONB, -- Encrypted sensitive data
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Indexes for payments
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_tx ON payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

-- =====================================================
-- 9. MESSAGING DOMAIN
-- =====================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    participant1_id UUID NOT NULL CONSTRAINT conversations_participant1_id_fkey REFERENCES users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL CONSTRAINT conversations_participant2_id_fkey REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for conversations
CREATE INDEX idx_conversations_order_id ON conversations(order_id);

CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_conversation_participant UNIQUE (conversation_id, user_id)
);

-- Indexes for conversation_participants
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- =====================================================
-- 10. DELIVERIES DOMAIN
-- =====================================================

CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_year INTEGER,
    license_plate VARCHAR(50) NOT NULL,
    drivers_license_number VARCHAR(100) NOT NULL,
    license_expiry_date DATE NOT NULL,
    license_image_url TEXT,
    insurance_policy_number VARCHAR(100),
    insurance_expiry_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT FALSE,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_deliveries INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_driver_rating CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT valid_vehicle_year CHECK (vehicle_year IS NULL OR (vehicle_year >= 1900 AND vehicle_year <= EXTRACT(YEAR FROM NOW()) + 1)),
    CONSTRAINT valid_driver_counters CHECK (total_reviews >= 0 AND total_deliveries >= 0)
);

-- Indexes for driver_profiles
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_available ON driver_profiles(is_available, is_verified) WHERE is_available = TRUE;

CREATE TYPE delivery_status AS ENUM (
    'unassigned',
    'assigned',
    'en_route_to_pickup',
    'arrived_at_pickup',
    'picked_up',
    'in_transit',
    'arrived_at_delivery',
    'delivered',
    'cancelled'
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status delivery_status NOT NULL DEFAULT 'unassigned',
    pickup_address VARCHAR(255) NOT NULL,
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    delivery_address VARCHAR(255) NOT NULL,
    delivery_latitude DECIMAL(10, 8) NOT NULL,
    delivery_longitude DECIMAL(11, 8) NOT NULL,
    distance_km DECIMAL(6, 2),
    estimated_duration_minutes INTEGER,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    driver_earnings DECIMAL(10, 2),
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    driver_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_delivery_locations CHECK (
        pickup_latitude BETWEEN -90 AND 90 AND
        pickup_longitude BETWEEN -180 AND 180 AND
        delivery_latitude BETWEEN -90 AND 90 AND
        delivery_longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT valid_delivery_amounts CHECK (
        delivery_fee >= 0 AND
        (driver_earnings IS NULL OR driver_earnings >= 0)
    )
);

-- Indexes for deliveries
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id, created_at DESC);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_unassigned ON deliveries(status, created_at) WHERE status = 'unassigned';
CREATE INDEX idx_deliveries_pickup_location ON deliveries(pickup_latitude, pickup_longitude);

CREATE TABLE delivery_location_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_location CHECK (
        latitude BETWEEN -90 AND 90 AND
        longitude BETWEEN -180 AND 180
    )
);

-- Indexes for delivery_location_updates
CREATE INDEX idx_delivery_location_delivery ON delivery_location_updates(delivery_id, timestamp DESC);

-- =====================================================
-- 11. RATINGS & REVIEWS DOMAIN
-- =====================================================

CREATE TABLE product_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL,
    review_text TEXT,
    images JSONB,
    is_verified_purchase BOOLEAN DEFAULT TRUE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_product_review UNIQUE (product_id, order_id, buyer_id),
    CONSTRAINT valid_product_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT valid_helpful_count CHECK (helpful_count >= 0)
);

-- Indexes for product_reviews
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id, created_at DESC);
CREATE INDEX idx_product_reviews_buyer_id ON product_reviews(buyer_id);
CREATE INDEX idx_product_reviews_order_id ON product_reviews(order_id);

CREATE TABLE store_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL,
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_store_review UNIQUE (store_id, order_id, buyer_id),
    CONSTRAINT valid_store_review_rating CHECK (rating BETWEEN 1 AND 5)
);

-- Indexes for store_reviews
CREATE INDEX idx_store_reviews_store_id ON store_reviews(store_id, created_at DESC);
CREATE INDEX idx_store_reviews_buyer_id ON store_reviews(buyer_id);
CREATE INDEX idx_store_reviews_order_id ON store_reviews(order_id);

CREATE TABLE driver_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL,
    review_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_driver_review UNIQUE (driver_id, order_id, buyer_id),
    CONSTRAINT valid_driver_review_rating CHECK (rating BETWEEN 1 AND 5)
);

-- Indexes for driver_reviews
CREATE INDEX idx_driver_reviews_driver_id ON driver_reviews(driver_id, created_at DESC);
CREATE INDEX idx_driver_reviews_buyer_id ON driver_reviews(buyer_id);
CREATE INDEX idx_driver_reviews_order_id ON driver_reviews(order_id);

CREATE TYPE review_type AS ENUM ('product', 'store');

CREATE TABLE review_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL,
    review_type review_type NOT NULL,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for review_responses
CREATE INDEX idx_review_responses_review ON review_responses(review_type, review_id);
CREATE INDEX idx_review_responses_seller ON review_responses(seller_id);

-- =====================================================
-- 12. ADVERTISING/PROMOTIONS DOMAIN
-- =====================================================

CREATE TABLE promoted_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    budget_allocated DECIMAL(10, 2) NOT NULL,
    budget_spent DECIMAL(10, 2) DEFAULT 0,
    cost_per_click DECIMAL(10, 2) DEFAULT 0.10,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_promotion_budget CHECK (
        budget_allocated > 0 AND
        budget_spent >= 0 AND
        budget_spent <= budget_allocated
    ),
    CONSTRAINT valid_promotion_dates CHECK (end_date > start_date),
    CONSTRAINT valid_promotion_counters CHECK (
        total_impressions >= 0 AND
        total_clicks >= 0 AND
        total_conversions >= 0
    )
);

-- Indexes for promoted_products
CREATE INDEX idx_promoted_products_product_id ON promoted_products(product_id);
CREATE INDEX idx_promoted_products_store_id ON promoted_products(store_id);
CREATE INDEX idx_promoted_products_active ON promoted_products(is_active, start_date, end_date) WHERE is_active = TRUE;

CREATE TABLE featured_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    budget_allocated DECIMAL(10, 2) NOT NULL,
    budget_spent DECIMAL(10, 2) DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_featured_budget CHECK (
        budget_allocated > 0 AND
        budget_spent >= 0 AND
        budget_spent <= budget_allocated
    ),
    CONSTRAINT valid_featured_dates CHECK (end_date > start_date),
    CONSTRAINT valid_featured_counters CHECK (
        total_impressions >= 0 AND
        total_clicks >= 0
    )
);

-- Indexes for featured_stores
CREATE INDEX idx_featured_stores_store_id ON featured_stores(store_id);
CREATE INDEX idx_featured_stores_active ON featured_stores(is_active, start_date, end_date) WHERE is_active = TRUE;

CREATE TABLE promotion_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    promoted_product_id UUID NOT NULL REFERENCES promoted_products(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    spend DECIMAL(10, 2) DEFAULT 0,
    revenue DECIMAL(10, 2) DEFAULT 0,
    
    CONSTRAINT unique_promotion_analytics UNIQUE (promoted_product_id, date),
    CONSTRAINT valid_analytics_counters CHECK (
        impressions >= 0 AND
        clicks >= 0 AND
        conversions >= 0 AND
        spend >= 0 AND
        revenue >= 0
    )
);

-- Indexes for promotion_analytics
CREATE INDEX idx_promotion_analytics_product ON promotion_analytics(promoted_product_id, date DESC);

-- =====================================================
-- 13. NOTIFICATIONS DOMAIN
-- =====================================================

CREATE TYPE notification_type AS ENUM (
    'order_received',
    'order_confirmed',
    'order_shipped',
    'order_delivered',
    'message_received',
    'review_received',
    'payment_success',
    'payment_failed',
    'promotion_ending',
    'low_stock'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    related_id UUID,
    related_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    sent_via_push BOOLEAN DEFAULT FALSE,
    sent_via_email BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(user_id, type);

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    order_updates BOOLEAN DEFAULT TRUE,
    message_updates BOOLEAN DEFAULT TRUE,
    review_updates BOOLEAN DEFAULT TRUE,
    promotion_updates BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification_preferences
CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);

-- =====================================================
-- 14. SECURITY & MODERATION DOMAIN
-- =====================================================

CREATE TYPE report_reason AS ENUM (
    'spam',
    'fraud',
    'inappropriate_content',
    'counterfeit',
    'misleading_info',
    'harassment',
    'other'
);

CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'dismissed');

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_entity_type VARCHAR(50) NOT NULL,
    reported_entity_id UUID NOT NULL,
    reason report_reason NOT NULL,
    description TEXT,
    status report_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_entity_type CHECK (reported_entity_type IN ('user', 'store', 'product', 'review'))
);

-- Indexes for reports
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_entity ON reports(reported_entity_type, reported_entity_id);
CREATE INDEX idx_reports_status ON reports(status, created_at);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, timestamp DESC);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default roles
INSERT INTO roles (id, name, display_name, description) VALUES
    (uuid_generate_v4(), 'buyer', 'Buyer', 'Can browse products, make purchases, and leave reviews'),
    (uuid_generate_v4(), 'seller', 'Seller', 'Can create stores, list products, and manage orders'),
    (uuid_generate_v4(), 'driver', 'Driver', 'Can accept and complete delivery assignments');

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence for order numbers
CREATE SEQUENCE order_number_seq START 1;

-- Trigger to auto-generate order numbers
CREATE TRIGGER generate_order_number_trigger BEFORE INSERT ON orders
    FOR EACH ROW WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- Function to create user profile on user registration
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, full_name)
    VALUES (NEW.id, 'User');
    
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create profile
CREATE TRIGGER create_user_profile_trigger AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Function to update product average rating
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET 
        average_rating = (SELECT AVG(rating) FROM product_reviews WHERE product_id = NEW.product_id),
        total_reviews = (SELECT COUNT(*) FROM product_reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update product ratings
CREATE TRIGGER update_product_rating_trigger AFTER INSERT OR UPDATE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- Function to update store average rating
CREATE OR REPLACE FUNCTION update_store_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stores
    SET 
        average_rating = (SELECT AVG(rating) FROM store_reviews WHERE store_id = NEW.store_id),
        total_reviews = (SELECT COUNT(*) FROM store_reviews WHERE store_id = NEW.store_id)
    WHERE id = NEW.store_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update store ratings
CREATE TRIGGER update_store_rating_trigger AFTER INSERT OR UPDATE ON store_reviews
    FOR EACH ROW EXECUTE FUNCTION update_store_rating();

-- Function to update driver average rating
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE driver_profiles
    SET 
        average_rating = (SELECT AVG(rating) FROM driver_reviews WHERE driver_id = NEW.driver_id),
        total_reviews = (SELECT COUNT(*) FROM driver_reviews WHERE driver_id = NEW.driver_id)
    WHERE user_id = NEW.driver_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update driver ratings
CREATE TRIGGER update_driver_rating_trigger AFTER INSERT OR UPDATE ON driver_reviews
    FOR EACH ROW EXECUTE FUNCTION update_driver_rating();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Core user accounts with authentication credentials';
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE roles IS 'System roles: buyer, seller, driver';
COMMENT ON TABLE user_roles IS 'Many-to-many relationship between users and roles';
COMMENT ON TABLE stores IS 'Seller storefronts';
COMMENT ON TABLE products IS 'Product listings';
COMMENT ON TABLE inventory IS 'Product stock management';
COMMENT ON TABLE carts IS 'User shopping carts';
COMMENT ON TABLE orders IS 'Purchase orders';
COMMENT ON TABLE payments IS 'Payment transactions';
COMMENT ON TABLE deliveries IS 'Delivery assignments and tracking';
COMMENT ON TABLE messages IS 'In-app messaging between users';
COMMENT ON TABLE notifications IS 'System notifications';

-- =====================================================
-- END OF MIGRATION 001
-- =====================================================
