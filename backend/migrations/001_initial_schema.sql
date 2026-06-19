-- =====================================================
-- Shopyos E-commerce Platform
-- PostgreSQL Consolidated Schema
-- Single source of truth: merges migrations 001–057
-- Generated: 2026-06-17
-- =====================================================
-- Run on a fresh PostgreSQL/Supabase database.
-- All CREATE TABLE / CREATE INDEX use IF NOT EXISTS.
-- All ENUMs include every value ever added by ALTER TYPE.
-- ALTER TABLE column additions have been folded inline.
-- =====================================================


-- =====================================================
-- SECTION 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =====================================================
-- SECTION 2: CUSTOM TYPES / ENUMS
-- =====================================================

-- order_status: original + 'preparing' (migration 010)
CREATE TYPE order_status AS ENUM (
    'pending',
    'payment_processing',
    'paid',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'completed',
    'cancelled',
    'refunded'
);

CREATE TYPE payment_method AS ENUM ('card', 'mobile_money', 'bank_transfer');
CREATE TYPE payment_status  AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

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

-- review_type: original had ('product','store'); migration 019 added 'driver'
CREATE TYPE review_type AS ENUM ('product', 'store', 'driver');

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

-- notification_type: original values + all values added across migrations 009, 044, 047
CREATE TYPE notification_type AS ENUM (
    -- original (migration 001)
    'order_received',
    'order_confirmed',
    'order_shipped',
    'order_delivered',
    'message_received',
    'review_received',
    'payment_success',
    'payment_failed',
    'promotion_ending',
    'low_stock',
    -- migration 009: order-related
    'order_placed',
    'new_order',
    'order_update',
    'order_picked_up',
    'order_preparing',
    'order_ready_for_pickup',
    'order_cancelled',
    'order_completed',
    -- migration 009: delivery
    'delivery_update',
    'delivery_assigned',
    'delivery_in_transit',
    'delivery_issue',
    -- migration 009: messaging / review
    'new_message',
    'new_review',
    -- migration 044: scheduler broadcast
    'admin_broadcast',
    'holiday_celebration',
    'daily_engagement',
    -- migration 044: verification
    'business_verification',
    'driver_verification',
    -- migration 044: additional order statuses
    'order_pending',
    'order_paid',
    'order_payment_processing',
    'order_assigned',
    'order_in_transit',
    'order_refunded',
    'order_failed',
    -- migration 047: new feature types
    'cart_abandonment',
    'price_drop',
    'back_in_stock',
    'return_requested',
    'return_approved',
    'return_declined',
    'refund_issued',
    'seller_review_response',
    'loyalty_earned',
    'badge_awarded'
);

-- Scheduled notification enums (migration 037)
CREATE TYPE scheduled_notification_status  AS ENUM ('pending', 'processing', 'sent', 'failed');
CREATE TYPE notification_recipient_type    AS ENUM ('all', 'stores', 'drivers', 'customers', 'specific');
CREATE TYPE notification_campaign_type     AS ENUM ('manual', 'holiday', 'daily_engagement');


-- =====================================================
-- SECTION 3: SEQUENCES
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;


-- =====================================================
-- SECTION 4: TABLES
-- =====================================================
-- Order: independent tables first, then FK-dependents.

-- --------------------------------------------------
-- 4.1 USERS & AUTHENTICATION
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                       VARCHAR(255) UNIQUE NOT NULL,
    password_hash               VARCHAR(255) NOT NULL,
    email_verified              BOOLEAN     DEFAULT FALSE,
    email_verification_token    VARCHAR(255),
    email_verification_expires  TIMESTAMPTZ,
    password_reset_token        VARCHAR(255),
    password_reset_expires      TIMESTAMPTZ,
    is_active                   BOOLEAN     DEFAULT TRUE,
    last_login_at               TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ,

    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_active     ON users(is_active) WHERE deleted_at IS NULL;


-- --------------------------------------------------
-- 4.2 ROLES & PERMISSIONS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_role_name CHECK (name IN ('buyer', 'seller', 'driver', 'admin'))
);

CREATE TABLE IF NOT EXISTS user_roles (
    id          UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID     NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active   BOOLEAN  DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id  ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id  ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active   ON user_roles(user_id, is_active);


-- --------------------------------------------------
-- 4.3 USER PROFILES
-- (references users, referenced by referrals/wallet)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name         VARCHAR(255) NOT NULL,
    phone             VARCHAR(20),
    avatar_url        TEXT,
    date_of_birth     DATE,
    gender            VARCHAR(20),
    address_line1     VARCHAR(255),
    address_line2     VARCHAR(255),
    city              VARCHAR(100),
    state_province    VARCHAR(100),
    postal_code       VARCHAR(20),
    country           VARCHAR(100),
    latitude          DECIMAL(10, 8),
    longitude         DECIMAL(11, 8),
    -- migration 025: referral & wallet
    referral_code     VARCHAR(20) UNIQUE,
    referred_by_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    wallet_balance    DECIMAL(12, 2) DEFAULT 0.00,
    -- migration 030: onboarding state
    onboarding_state  JSONB       DEFAULT '{}'::jsonb,
    -- migration 042: presence
    is_online         BOOLEAN     DEFAULT FALSE,
    last_seen         TIMESTAMPTZ DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_latitude  CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id  ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON user_profiles(latitude, longitude) WHERE latitude IS NOT NULL;


-- --------------------------------------------------
-- 4.4 REFRESH TOKENS (migration 013)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash     TEXT     NOT NULL UNIQUE,
    family_id      UUID     NOT NULL DEFAULT gen_random_uuid(),
    device_info    TEXT,
    ip_address     INET,
    is_revoked     BOOLEAN  NOT NULL DEFAULT FALSE,
    revoked_at     TIMESTAMPTZ,
    revoked_reason TEXT,
    expires_at     TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replaced_by    UUID     REFERENCES refresh_tokens(id)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash   ON refresh_tokens(token_hash) WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE is_revoked = FALSE;


-- --------------------------------------------------
-- 4.5 CATEGORIES (migration 007)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id   UUID        REFERENCES categories(id) ON DELETE SET NULL,
    image_url   TEXT,
    is_active   BOOLEAN     DEFAULT TRUE,
    -- migration 022/028: creator FK pointing to public.users
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);


-- --------------------------------------------------
-- 4.6 STORES
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS stores (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id                UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_name              VARCHAR(255) NOT NULL,
    slug                    VARCHAR(255) UNIQUE NOT NULL,
    description             TEXT        NOT NULL,
    logo_url                TEXT,
    banner_url              TEXT,
    email                   VARCHAR(255),
    phone                   VARCHAR(20)  NOT NULL,
    address_line1           VARCHAR(255) NOT NULL,
    address_line2           VARCHAR(255),
    city                    VARCHAR(100) NOT NULL,
    state_province          VARCHAR(100),
    postal_code             VARCHAR(20),
    country                 VARCHAR(100) NOT NULL,
    latitude                DECIMAL(10, 8),
    longitude               DECIMAL(11, 8),
    category                VARCHAR(100) NOT NULL,
    is_verified             BOOLEAN     DEFAULT FALSE,
    is_active               BOOLEAN     DEFAULT TRUE,
    is_featured             BOOLEAN     DEFAULT FALSE,
    featured_until          TIMESTAMPTZ,
    average_rating          DECIMAL(3, 2) DEFAULT 0,
    total_reviews           INTEGER     DEFAULT 0,
    total_sales             INTEGER     DEFAULT 0,
    -- migration 003: payouts & balance
    payout_method           VARCHAR(20)  DEFAULT 'bank' CHECK (payout_method IN ('bank', 'momo')),
    payout_details          JSONB,
    current_balance         DECIMAL(12, 2) DEFAULT 0,
    -- migration 022: delivery fees
    delivery_base_fee       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_per_km_fee     NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_max_km         NUMERIC(10, 2) DEFAULT NULL,
    -- migration 023: verification
    verification_status     VARCHAR(20),
    verified_at             TIMESTAMPTZ,
    rejection_reason        TEXT,
    verification_notes      TEXT,
    -- migration 024: verification docs
    business_cert_url       TEXT,
    tax_id                  VARCHAR(100),
    business_license_url    TEXT,
    bank_name               VARCHAR(100),
    account_name            VARCHAR(255),
    account_number          VARCHAR(50),
    proof_of_bank_url       TEXT,
    -- migration 024b: listing tier
    listing_tier            VARCHAR(20)  DEFAULT 'free',
    listing_fee_paid_at     TIMESTAMPTZ,
    listing_fee_reference   VARCHAR(100),
    -- migration 027: trust flag
    is_trusted              BOOLEAN     DEFAULT FALSE,
    -- migration 039: web & socials
    website_url             TEXT,
    social_instagram        TEXT,
    social_facebook         TEXT,
    registration_number     VARCHAR(100),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_average_rating     CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT valid_total_reviews      CHECK (total_reviews >= 0),
    CONSTRAINT valid_total_sales        CHECK (total_sales >= 0),
    CONSTRAINT valid_store_latitude     CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT valid_store_longitude    CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_stores_owner_id          ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug              ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_name              ON stores(store_name);
CREATE INDEX IF NOT EXISTS idx_stores_category          ON stores(category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stores_active            ON stores(is_active);
CREATE INDEX IF NOT EXISTS idx_stores_featured          ON stores(is_featured, featured_until) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_stores_location          ON stores(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stores_rating            ON stores(average_rating DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_stores_verification_status ON stores(verification_status);
CREATE INDEX IF NOT EXISTS idx_stores_is_trusted        ON stores(is_trusted);
CREATE INDEX IF NOT EXISTS idx_stores_owner             ON stores(owner_id, is_active);


-- --------------------------------------------------
-- 4.7 PRODUCTS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id                UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title                   VARCHAR(255) NOT NULL,
    slug                    VARCHAR(255),
    description             TEXT        NOT NULL,
    price                   DECIMAL(10, 2) NOT NULL,
    compare_at_price        DECIMAL(10, 2),
    category                VARCHAR(100) NOT NULL,
    subcategory             VARCHAR(100),
    sku                     VARCHAR(100),
    is_active               BOOLEAN     DEFAULT TRUE,
    is_promoted             BOOLEAN     DEFAULT FALSE,
    promoted_until          TIMESTAMPTZ,
    promotion_budget        DECIMAL(10, 2),
    promotion_impressions   INTEGER     DEFAULT 0,
    promotion_clicks        INTEGER     DEFAULT 0,
    average_rating          DECIMAL(3, 2) DEFAULT 0,
    total_reviews           INTEGER     DEFAULT 0,
    total_sales             INTEGER     DEFAULT 0,
    view_count              INTEGER     DEFAULT 0,
    brand                   VARCHAR(100),
    weight_kg               DECIMAL(10, 2),
    dimensions              JSONB,
    tags                    JSONB,
    -- migration 043: gender filter
    gender                  VARCHAR(50)  DEFAULT 'Unisex',
    -- migration 046: stock visibility
    is_in_stock             BOOLEAN     NOT NULL DEFAULT TRUE,
    -- migration 052: pre-order
    is_preorder             BOOLEAN     NOT NULL DEFAULT FALSE,
    preorder_available_date TIMESTAMPTZ,
    -- migration 057: product-level attributes
    attributes              JSONB       DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT valid_price              CHECK (price > 0),
    CONSTRAINT valid_compare_price      CHECK (compare_at_price IS NULL OR compare_at_price >= price),
    CONSTRAINT valid_product_rating     CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT valid_promotion_budget   CHECK (promotion_budget IS NULL OR promotion_budget >= 0),
    CONSTRAINT valid_counters           CHECK (
        promotion_impressions >= 0 AND
        promotion_clicks      >= 0 AND
        total_reviews         >= 0 AND
        total_sales           >= 0 AND
        view_count            >= 0
    ),
    CONSTRAINT valid_gender             CHECK (gender IN ('Men', 'Women', 'Unisex', 'Boys', 'Girls'))
);

CREATE INDEX IF NOT EXISTS idx_products_store_id         ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_title            ON products(title) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category         ON products(category) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active           ON products(store_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_promoted         ON products(is_promoted, promoted_until) WHERE is_promoted = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_price            ON products(price) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_rating           ON products(average_rating DESC) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_created          ON products(created_at DESC) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_search           ON products USING GIN(to_tsvector('english', title || ' ' || description)) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_active  ON products(category, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_store_active     ON products(store_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_at       ON products(created_at DESC) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_gender           ON products(gender) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_attributes       ON products USING GIN(attributes) WHERE is_active = TRUE AND deleted_at IS NULL;


-- --------------------------------------------------
-- 4.8 PRODUCT IMAGES
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS product_images (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id          UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url           TEXT    NOT NULL,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    alt_text            VARCHAR(255),
    display_order       INTEGER DEFAULT 0,
    is_primary          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_display_order CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, display_order);
CREATE INDEX IF NOT EXISTS idx_product_images_primary    ON product_images(product_id) WHERE is_primary = TRUE;


-- --------------------------------------------------
-- 4.9 PRODUCT VARIANTS (migration 051)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS product_variants (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku              TEXT,
    attributes       JSONB       NOT NULL DEFAULT '{}',
    price            NUMERIC(10, 2),
    compare_at_price NUMERIC(10, 2),
    stock_quantity   INTEGER     NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url        TEXT,
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variant_options (
    id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    option_name   TEXT    NOT NULL,
    option_values TEXT[]  NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (product_id, option_name)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product      ON product_variants(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku   ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variant_options_product ON product_variant_options(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_options_values         ON product_variant_options USING GIN(option_values);


-- --------------------------------------------------
-- 4.10 INVENTORY
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id          UUID    UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity            INTEGER NOT NULL DEFAULT 0,
    reserved_quantity   INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    track_inventory     BOOLEAN DEFAULT TRUE,
    allow_backorder     BOOLEAN DEFAULT FALSE,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_quantities CHECK (
        quantity          >= 0 AND
        reserved_quantity >= 0 AND
        reserved_quantity <= quantity AND
        low_stock_threshold >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock  ON inventory(product_id) WHERE quantity <= low_stock_threshold;
CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory(product_id);


-- --------------------------------------------------
-- 4.11 PRODUCT WAITLIST (migration 052)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS product_waitlist (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    notified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_waitlist_product ON product_waitlist(product_id) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_waitlist_user    ON product_waitlist(user_id);


-- --------------------------------------------------
-- 4.12 SHOPPING CARTS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS carts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- migration 048: abandonment tracking
    last_activity           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    abandonment_notified_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id         ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_abandonment_sweep ON carts(last_activity) WHERE abandonment_notified_at IS NULL;

CREATE TABLE IF NOT EXISTS cart_items (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id      UUID        NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id   UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    -- migration 051: variant reference
    variant_id   UUID        REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity     INTEGER     NOT NULL DEFAULT 1,
    price_at_add DECIMAL(10, 2) NOT NULL,
    added_at     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_cart_product  UNIQUE (cart_id, product_id),
    CONSTRAINT valid_cart_quantity  CHECK (quantity > 0),
    CONSTRAINT valid_cart_price     CHECK (price_at_add > 0)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id    ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart       ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product    ON cart_items(cart_id, product_id);


-- --------------------------------------------------
-- 4.13 DELIVERY SLOTS (migration 053)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery_slots (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID    REFERENCES stores(id) ON DELETE CASCADE,  -- NULL = platform-wide
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    slot_start  TIME    NOT NULL,
    slot_end    TIME    NOT NULL,
    max_orders  INTEGER NOT NULL DEFAULT 20,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_delivery_slots_store ON delivery_slots(store_id, day_of_week) WHERE is_active = TRUE;


-- --------------------------------------------------
-- 4.14 PROMO CODES (migration 055)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS promo_codes (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(50)   NOT NULL UNIQUE,
    type       TEXT          NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value      DECIMAL(10, 2) NOT NULL CHECK (value > 0),
    min_order  DECIMAL(10, 2) NOT NULL DEFAULT 0,
    max_uses   INTEGER,
    uses_count INTEGER       NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active  BOOLEAN       NOT NULL DEFAULT true,
    store_id   UUID          REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(UPPER(code));


-- --------------------------------------------------
-- 4.15 ORDERS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
    id                          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number                VARCHAR(50)     UNIQUE NOT NULL,
    buyer_id                    UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_id                    UUID            NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    status                      order_status    NOT NULL DEFAULT 'pending',
    subtotal                    DECIMAL(10, 2)  NOT NULL,
    tax                         DECIMAL(10, 2)  DEFAULT 0,
    delivery_fee                DECIMAL(10, 2)  DEFAULT 0,
    total_amount                DECIMAL(10, 2)  NOT NULL,
    currency                    VARCHAR(3)      DEFAULT 'USD',
    -- migration 055: discounts & promo
    discount_amount             DECIMAL(10, 2)  NOT NULL DEFAULT 0,
    promo_code_id               UUID            REFERENCES promo_codes(id) ON DELETE SET NULL,
    loyalty_points_used         INTEGER         NOT NULL DEFAULT 0,
    -- delivery address (original line fields + migration 004 generic field)
    delivery_address_line1      VARCHAR(255)    NOT NULL,
    delivery_address_line2      VARCHAR(255),
    delivery_city               VARCHAR(100)    NOT NULL,
    delivery_state_province     VARCHAR(100),
    delivery_postal_code        VARCHAR(20),
    delivery_country            VARCHAR(100)    NOT NULL,
    delivery_latitude           DECIMAL(10, 8),
    delivery_longitude          DECIMAL(11, 8),
    -- migration 004: additional delivery fields
    delivery_phone              VARCHAR(20),
    delivery_notes              TEXT,
    delivery_address            TEXT,
    buyer_notes                 TEXT,
    -- migration 023: escrow
    platform_fee                NUMERIC(10, 2),
    seller_payout_amount        NUMERIC(10, 2),
    escrow_status               VARCHAR(50)     DEFAULT 'PENDING',
    payout_released_at          TIMESTAMPTZ,
    -- migration 035: PIN verification
    verification_pin            VARCHAR(6),
    pin_verified_at             TIMESTAMPTZ,
    -- migration 053: scheduled delivery
    scheduled_delivery_date     DATE,
    scheduled_delivery_slot_id  UUID            REFERENCES delivery_slots(id) ON DELETE SET NULL,
    scheduled_delivery_label    TEXT,
    created_at                  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     DEFAULT NOW(),
    paid_at                     TIMESTAMPTZ,
    confirmed_at                TIMESTAMPTZ,
    cancelled_at                TIMESTAMPTZ,
    cancellation_reason         TEXT,

    CONSTRAINT valid_order_amounts CHECK (
        subtotal     >= 0 AND
        tax          >= 0 AND
        delivery_fee >= 0 AND
        total_amount  = subtotal + tax + delivery_fee
    ),
    CONSTRAINT valid_delivery_latitude  CHECK (delivery_latitude  BETWEEN -90  AND 90),
    CONSTRAINT valid_delivery_longitude CHECK (delivery_longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_orders_order_number   ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id       ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_id       ON orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status   ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store_status   ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created        ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created  ON orders(buyer_id, created_at DESC);


-- --------------------------------------------------
-- 4.16 ORDER ITEMS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS order_items (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id            UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id          UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_title       VARCHAR(255) NOT NULL,
    product_sku         VARCHAR(100),
    quantity            INTEGER     NOT NULL,
    price               DECIMAL(10, 2) NOT NULL,
    subtotal            DECIMAL(10, 2) NOT NULL,
    -- migration 051: variant tracking
    variant_id          UUID        REFERENCES product_variants(id) ON DELETE SET NULL,
    variant_attributes  JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_order_item_quantity  CHECK (quantity > 0),
    CONSTRAINT valid_order_item_price     CHECK (price > 0),
    CONSTRAINT valid_order_item_subtotal  CHECK (subtotal = quantity * price)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product    ON order_items(product_id);


-- --------------------------------------------------
-- 4.17 PROMO CODE USES (migration 055)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS promo_code_uses (
    id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id  UUID        NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
    user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID        REFERENCES orders(id) ON DELETE SET NULL,
    used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user ON promo_code_uses(user_id);


-- --------------------------------------------------
-- 4.18 PAYMENTS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS payments (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                UUID            UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    payment_method          payment_method  NOT NULL,
    payment_provider        VARCHAR(50),
    provider_transaction_id VARCHAR(255),
    amount                  DECIMAL(10, 2)  NOT NULL,
    currency                VARCHAR(3)      DEFAULT 'USD',
    status                  payment_status  NOT NULL DEFAULT 'pending',
    payment_details         JSONB,
    paid_at                 TIMESTAMPTZ,
    failed_at               TIMESTAMPTZ,
    failure_reason          TEXT,
    created_at              TIMESTAMPTZ     DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     DEFAULT NOW(),

    CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id    ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_tx ON payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_order       ON payments(order_id);


-- --------------------------------------------------
-- 4.19 USER PAYMENT METHODS (migration 012)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS user_payment_methods (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(20) NOT NULL,
    provider   VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    is_default BOOLEAN     DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_payment_identifier UNIQUE (user_id, identifier)
);

CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON user_payment_methods(user_id);


-- --------------------------------------------------
-- 4.20 MESSAGING
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
    participant1_id UUID NOT NULL CONSTRAINT conversations_participant1_id_fkey REFERENCES users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL CONSTRAINT conversations_participant2_id_fkey REFERENCES users(id) ON DELETE CASCADE,
    -- migration 034: support conversations
    is_support     BOOLEAN DEFAULT FALSE,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id);

CREATE TABLE IF NOT EXISTS conversation_participants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_conversation_participant UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user         ON conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS messages (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id     UUID    NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id           UUID    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content             TEXT    NOT NULL,
    -- migration 004: rich messaging
    message_type        VARCHAR(20) DEFAULT 'text',
    attachment_url      TEXT,
    -- migration 038: reply threading
    reply_to_message_id UUID    REFERENCES messages(id) ON DELETE SET NULL,
    -- migration 041: moderation
    is_moderated        BOOLEAN DEFAULT FALSE,
    -- migration 042: attachment metadata
    attachment_meta     JSONB,
    is_read             BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id       ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread          ON messages(conversation_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_type            ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_conversation    ON messages(conversation_id, created_at DESC);


-- --------------------------------------------------
-- 4.21 DELIVERIES
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS driver_profiles (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type            VARCHAR(50) NOT NULL,
    vehicle_make            VARCHAR(100),
    vehicle_model           VARCHAR(100),
    vehicle_year            INTEGER,
    license_plate           VARCHAR(50) NOT NULL,
    drivers_license_number  VARCHAR(100) NOT NULL,
    license_expiry_date     DATE        NOT NULL,
    license_image_url       TEXT,
    insurance_policy_number VARCHAR(100),
    insurance_expiry_date   DATE,
    is_verified             BOOLEAN     DEFAULT FALSE,
    is_available            BOOLEAN     DEFAULT FALSE,
    average_rating          DECIMAL(3, 2) DEFAULT 0,
    total_reviews           INTEGER     DEFAULT 0,
    total_deliveries        INTEGER     DEFAULT 0,
    -- migration 025: verification documents
    insurance_doc_url       TEXT,
    national_id_url         TEXT,
    vehicle_reg_url         TEXT,
    roadworthy_url          TEXT,
    rejection_reason        TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_driver_rating    CHECK (average_rating BETWEEN 0 AND 5),
    CONSTRAINT valid_vehicle_year     CHECK (vehicle_year IS NULL OR (vehicle_year >= 1900 AND vehicle_year <= EXTRACT(YEAR FROM NOW()) + 1)),
    CONSTRAINT valid_driver_counters  CHECK (total_reviews >= 0 AND total_deliveries >= 0)
);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id   ON driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_available ON driver_profiles(is_available, is_verified) WHERE is_available = TRUE;

CREATE TABLE IF NOT EXISTS deliveries (
    id                         UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id                   UUID             UNIQUE NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    driver_id                  UUID             REFERENCES users(id) ON DELETE SET NULL,
    status                     delivery_status  NOT NULL DEFAULT 'unassigned',
    pickup_address             VARCHAR(255)     NOT NULL,
    pickup_latitude            DECIMAL(10, 8)   NOT NULL,
    pickup_longitude           DECIMAL(11, 8)   NOT NULL,
    delivery_address           VARCHAR(255)     NOT NULL,
    delivery_latitude          DECIMAL(10, 8)   NOT NULL,
    delivery_longitude         DECIMAL(11, 8)   NOT NULL,
    distance_km                DECIMAL(6, 2),
    estimated_duration_minutes INTEGER,
    -- migration 004: time estimates
    estimated_pickup_time      TIMESTAMPTZ,
    estimated_delivery_time    TIMESTAMPTZ,
    delivery_fee               DECIMAL(10, 2)   DEFAULT 0,
    driver_earnings            DECIMAL(10, 2),
    assigned_at                TIMESTAMPTZ,
    picked_up_at               TIMESTAMPTZ,
    delivered_at               TIMESTAMPTZ,
    driver_notes               TEXT,
    created_at                 TIMESTAMPTZ      DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ      DEFAULT NOW(),

    CONSTRAINT valid_delivery_locations CHECK (
        pickup_latitude   BETWEEN -90  AND 90  AND
        pickup_longitude  BETWEEN -180 AND 180 AND
        delivery_latitude BETWEEN -90  AND 90  AND
        delivery_longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT valid_delivery_amounts CHECK (
        delivery_fee >= 0 AND
        (driver_earnings IS NULL OR driver_earnings >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id          ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id         ON deliveries(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status            ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_unassigned        ON deliveries(status, created_at) WHERE status = 'unassigned';
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location   ON deliveries(pickup_latitude, pickup_longitude);

CREATE TABLE IF NOT EXISTS delivery_location_updates (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID        NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    latitude    DECIMAL(10, 8) NOT NULL,
    longitude   DECIMAL(11, 8) NOT NULL,
    timestamp   TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_location CHECK (
        latitude  BETWEEN -90  AND 90 AND
        longitude BETWEEN -180 AND 180
    )
);

CREATE INDEX IF NOT EXISTS idx_delivery_location_delivery ON delivery_location_updates(delivery_id, timestamp DESC);


-- --------------------------------------------------
-- 4.22 RATINGS & REVIEWS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS product_reviews (
    id                   UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id           UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id             UUID    NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id             UUID    NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating               INTEGER NOT NULL,
    review_text          TEXT,
    images               JSONB,
    is_verified_purchase BOOLEAN DEFAULT TRUE,
    helpful_count        INTEGER DEFAULT 0,
    -- migration 019: community counters
    likes_count          INTEGER DEFAULT 0,
    comments_count       INTEGER DEFAULT 0,
    -- migration 010: soft-delete
    deleted_at           TIMESTAMPTZ,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_product_review     UNIQUE (product_id, order_id, buyer_id),
    CONSTRAINT valid_product_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT valid_helpful_count       CHECK (helpful_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_buyer_id   ON product_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id   ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product    ON product_reviews(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_reviews_buyer      ON product_reviews(buyer_id, product_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS store_reviews (
    id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id       UUID    NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    order_id       UUID    NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id       UUID    NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating         INTEGER NOT NULL,
    review_text    TEXT,
    likes_count    INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    deleted_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_store_review       UNIQUE (store_id, order_id, buyer_id),
    CONSTRAINT valid_store_review_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_store_reviews_store_id ON store_reviews(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_reviews_buyer_id ON store_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_store_reviews_order_id ON store_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_store_reviews_store    ON store_reviews(store_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS driver_reviews (
    id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id       UUID    NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    buyer_id       UUID    NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating         INTEGER NOT NULL,
    review_text    TEXT,
    likes_count    INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    deleted_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_driver_review       UNIQUE (driver_id, order_id, buyer_id),
    CONSTRAINT valid_driver_review_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_driver_reviews_driver_id ON driver_reviews(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_reviews_buyer_id  ON driver_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_driver_reviews_order_id  ON driver_reviews(order_id);

CREATE TABLE IF NOT EXISTS review_responses (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id     UUID        NOT NULL,
    review_type   review_type NOT NULL,
    seller_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_text TEXT        NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_type, review_id);
CREATE INDEX IF NOT EXISTS idx_review_responses_seller ON review_responses(seller_id);

-- Review community: likes & comments (migration 019)
CREATE TABLE IF NOT EXISTS review_likes (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id   UUID        NOT NULL,
    review_type review_type NOT NULL,
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (review_id, review_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_review ON review_likes(review_id, review_type);

CREATE TABLE IF NOT EXISTS review_comments (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id   UUID        NOT NULL,
    review_type review_type NOT NULL,
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    comment     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments(review_id, review_type);


-- --------------------------------------------------
-- 4.23 FAVORITES (migration 002)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS favorites (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id    ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);


-- --------------------------------------------------
-- 4.24 STORE FOLLOWS (migration 010)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS store_follows (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_store_follow UNIQUE (user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_follows_user  ON store_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_store_follows_store ON store_follows(store_id);


-- --------------------------------------------------
-- 4.25 ADVERTISING / PROMOTIONS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS promoted_products (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id       UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    store_id         UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    -- canonical columns (migration 031 renamed these; keep both for compat)
    budget           DECIMAL(10, 2) NOT NULL DEFAULT 0,         -- preferred column name
    spent_amount     DECIMAL(10, 2) NOT NULL DEFAULT 0,         -- preferred column name
    budget_allocated DECIMAL(10, 2) NOT NULL DEFAULT 0,         -- legacy alias
    budget_spent     DECIMAL(10, 2) DEFAULT 0,                  -- legacy alias
    cost_per_click   DECIMAL(10, 2) DEFAULT 0.10,
    impressions      INTEGER     NOT NULL DEFAULT 0,            -- preferred column name
    clicks           INTEGER     NOT NULL DEFAULT 0,            -- preferred column name
    total_impressions INTEGER    DEFAULT 0,                     -- legacy alias
    total_clicks     INTEGER     DEFAULT 0,                     -- legacy alias
    total_conversions INTEGER    DEFAULT 0,
    status           TEXT        NOT NULL DEFAULT 'active',     -- 'active', 'paused'
    is_active        BOOLEAN     DEFAULT TRUE,                  -- legacy alias
    start_date       TIMESTAMPTZ NOT NULL,
    end_date         TIMESTAMPTZ NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_promotion_dates    CHECK (end_date > start_date),
    CONSTRAINT valid_promotion_counters CHECK (
        total_impressions >= 0 AND
        total_clicks      >= 0 AND
        total_conversions >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_promoted_products_product_id ON promoted_products(product_id);
CREATE INDEX IF NOT EXISTS idx_promoted_products_store_id   ON promoted_products(store_id);
CREATE INDEX IF NOT EXISTS idx_promoted_products_active     ON promoted_products(is_active, start_date, end_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_promoted_products_status     ON promoted_products(status, start_date, end_date) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS featured_stores (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id         UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    budget_allocated DECIMAL(10, 2) NOT NULL,
    budget_spent     DECIMAL(10, 2) DEFAULT 0,
    start_date       TIMESTAMPTZ NOT NULL,
    end_date         TIMESTAMPTZ NOT NULL,
    is_active        BOOLEAN     DEFAULT TRUE,
    total_impressions INTEGER    DEFAULT 0,
    total_clicks     INTEGER     DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_featured_budget   CHECK (
        budget_allocated > 0 AND
        budget_spent     >= 0 AND
        budget_spent     <= budget_allocated
    ),
    CONSTRAINT valid_featured_dates    CHECK (end_date > start_date),
    CONSTRAINT valid_featured_counters CHECK (
        total_impressions >= 0 AND
        total_clicks      >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_featured_stores_store_id ON featured_stores(store_id);
CREATE INDEX IF NOT EXISTS idx_featured_stores_active   ON featured_stores(is_active, start_date, end_date) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS promotion_analytics (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    promoted_product_id UUID        NOT NULL REFERENCES promoted_products(id) ON DELETE CASCADE,
    date                DATE        NOT NULL,
    impressions         INTEGER     DEFAULT 0,
    clicks              INTEGER     DEFAULT 0,
    conversions         INTEGER     DEFAULT 0,
    spend               DECIMAL(10, 2) DEFAULT 0,
    revenue             DECIMAL(10, 2) DEFAULT 0,

    CONSTRAINT unique_promotion_analytics UNIQUE (promoted_product_id, date),
    CONSTRAINT valid_analytics_counters   CHECK (
        impressions >= 0 AND
        clicks      >= 0 AND
        conversions >= 0 AND
        spend       >= 0 AND
        revenue     >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_promotion_analytics_product ON promotion_analytics(promoted_product_id, date DESC);


-- --------------------------------------------------
-- 4.26 BANNER CAMPAIGNS (migration 026)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS banner_campaigns (
    id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id           UUID        REFERENCES stores(id) ON DELETE CASCADE,
    title              VARCHAR(255) NOT NULL,
    placement          VARCHAR(50) NOT NULL,
    duration_days      INTEGER     NOT NULL,
    paid_amount        DECIMAL(10, 2) NOT NULL,
    status             VARCHAR(20) DEFAULT 'Pending',
    banner_url         TEXT        NOT NULL,
    clicks             INTEGER     DEFAULT 0,
    impressions        INTEGER     DEFAULT 0,
    start_date         TIMESTAMP,
    end_date           TIMESTAMP,
    rejection_reason   TEXT,
    paystack_reference VARCHAR(100),
    created_at         TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at         TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);


-- --------------------------------------------------
-- 4.27 NOTIFICATIONS
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id             UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type           notification_type NOT NULL,
    title          VARCHAR(255)      NOT NULL,
    message        TEXT              NOT NULL,
    link           TEXT,
    related_id     UUID,
    related_type   VARCHAR(50),
    is_read        BOOLEAN           DEFAULT FALSE,
    -- migration 032: read timestamp
    read_at        TIMESTAMPTZ,
    sent_via_push  BOOLEAN           DEFAULT FALSE,
    sent_via_email BOOLEAN           DEFAULT FALSE,
    -- migration 008: additional metadata
    data           JSONB             DEFAULT '{}',
    created_at     TIMESTAMPTZ       DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id        ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread         ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type           ON notifications(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread    ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at   ON notifications(user_id, read_at) WHERE read_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_enabled      BOOLEAN     DEFAULT TRUE,
    email_enabled     BOOLEAN     DEFAULT TRUE,
    order_updates     BOOLEAN     DEFAULT TRUE,
    message_updates   BOOLEAN     DEFAULT TRUE,
    review_updates    BOOLEAN     DEFAULT TRUE,
    promotion_updates BOOLEAN     DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);


-- --------------------------------------------------
-- 4.28 NOTIFICATION LOGS (migration 020)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS notification_logs (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type   VARCHAR(100) NOT NULL,
    target       VARCHAR(255) NOT NULL,
    reference_id UUID,
    status       VARCHAR(50)  NOT NULL,
    error        TEXT,
    -- migration 021b: updated_at
    updated_at   TIMESTAMPTZ  DEFAULT NOW(),
    created_at   TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT unique_notification UNIQUE (event_type, target, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_lookup ON notification_logs(event_type, target, reference_id);


-- --------------------------------------------------
-- 4.29 EXPO PUSH TOKENS (migration 021a)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS expo_push_tokens (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expo_push_tokens_user ON expo_push_tokens(user_id);


-- --------------------------------------------------
-- 4.30 SCHEDULED NOTIFICATIONS (migration 037)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id             UUID                          PRIMARY KEY DEFAULT gen_random_uuid(),
    title          VARCHAR(255)                  NOT NULL,
    message        TEXT                          NOT NULL,
    send_email     BOOLEAN                       NOT NULL DEFAULT FALSE,
    send_sms       BOOLEAN                       NOT NULL DEFAULT FALSE,
    send_push      BOOLEAN                       NOT NULL DEFAULT TRUE,
    recipient_type notification_recipient_type   NOT NULL DEFAULT 'all',
    recipient_ids  UUID[]                        DEFAULT NULL,
    campaign_type  notification_campaign_type    NOT NULL DEFAULT 'manual',
    scheduled_at   TIMESTAMPTZ                   NOT NULL,
    status         scheduled_notification_status NOT NULL DEFAULT 'pending',
    error_message  TEXT                          DEFAULT NULL,
    sent_at        TIMESTAMPTZ                   DEFAULT NULL,
    created_by     UUID                          DEFAULT NULL,
    created_at     TIMESTAMPTZ                   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ                   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_notif_status_at ON scheduled_notifications(status, scheduled_at);


-- --------------------------------------------------
-- 4.31 SECURITY & MODERATION
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS reports (
    id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_entity_type VARCHAR(50)  NOT NULL,
    reported_entity_id  UUID          NOT NULL,
    reason              report_reason NOT NULL,
    description         TEXT,
    status              report_status DEFAULT 'pending',
    reviewed_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    resolution_notes    TEXT,
    created_at          TIMESTAMPTZ   DEFAULT NOW(),

    CONSTRAINT valid_entity_type CHECK (reported_entity_type IN ('user', 'store', 'product', 'review'))
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_entity   ON reports(reported_entity_type, reported_entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    metadata    JSONB,
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user      ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action    ON audit_logs(action, timestamp DESC);


-- --------------------------------------------------
-- 4.32 USER BLOCKS & USER REPORTS (migration 033)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);

-- user_reports: reporter_id nullable (migration 036 dropped NOT NULL for SET NULL compatibility)
CREATE TABLE IF NOT EXISTS user_reports (
    id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id   UUID        REFERENCES users(id) ON DELETE CASCADE,
    reported_store_id  UUID        REFERENCES stores(id) ON DELETE CASCADE,
    entity_type        VARCHAR(20) NOT NULL CHECK (entity_type IN ('user', 'store')),
    reason             VARCHAR(255) NOT NULL,
    details            TEXT,
    status             VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at        TIMESTAMPTZ,
    resolved_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes   TEXT,

    CONSTRAINT check_reported_entity CHECK (
        (entity_type = 'user'  AND reported_user_id  IS NOT NULL AND reported_store_id IS NULL) OR
        (entity_type = 'store' AND reported_store_id IS NOT NULL AND reported_user_id  IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status      ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON user_reports(reporter_id);


-- --------------------------------------------------
-- 4.33 PAYOUTS & BALANCE LOGS (migration 003)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS payouts (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id              UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    amount                DECIMAL(12, 2) NOT NULL,
    status                VARCHAR(20) DEFAULT 'pending',
    payout_method         VARCHAR(50) NOT NULL,
    payout_details        JSONB,
    transaction_reference VARCHAR(100),
    admin_notes           TEXT,
    processed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_store_id ON payouts(store_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status   ON payouts(status);

CREATE TABLE IF NOT EXISTS balance_logs (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id         UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    amount           DECIMAL(12, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    order_id         UUID        REFERENCES orders(id) ON DELETE SET NULL,
    payout_id        UUID        REFERENCES payouts(id) ON DELETE SET NULL,
    balance_after    DECIMAL(12, 2),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_logs_store ON balance_logs(store_id);


-- --------------------------------------------------
-- 4.34 WALLET LOGS (migration 035)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS wallet_logs (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount           DECIMAL(12, 2) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    order_id         UUID        REFERENCES orders(id) ON DELETE SET NULL,
    balance_after    DECIMAL(12, 2),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_logs_user ON wallet_logs(user_id);


-- --------------------------------------------------
-- 4.35 REFERRALS (migration 025)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS referrals (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id   UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    order_id      UUID        REFERENCES orders(id) ON DELETE SET NULL,
    status        VARCHAR(20) DEFAULT 'pending',
    reward_amount DECIMAL(10, 2) DEFAULT 20.00,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);


-- --------------------------------------------------
-- 4.36 RECOMMENDATION & SOCIAL FEATURES (migration 034)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS user_events (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    product_id  UUID        REFERENCES products(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    weight      SMALLINT    DEFAULT 1,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_events_user    ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_product ON user_events(product_id);

CREATE TABLE IF NOT EXISTS snaps (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id   UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID        REFERENCES products(id) ON DELETE SET NULL,
    media_url  TEXT        NOT NULL,
    caption    TEXT,
    view_count INTEGER     DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snaps_active ON snaps(expires_at);


-- --------------------------------------------------
-- 4.37 FLASH SALES (migration 045)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS flash_sales (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN     DEFAULT TRUE,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_sale_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS flash_sale_products (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    flash_sale_id UUID        NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
    product_id    UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    flash_price   DECIMAL(10, 2) NOT NULL,
    stock_limit   INTEGER,
    sold_count    INTEGER     DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (flash_sale_id, product_id),
    CONSTRAINT positive_flash_price CHECK (flash_price > 0),
    CONSTRAINT valid_stock          CHECK (stock_limit IS NULL OR stock_limit > 0)
);

CREATE INDEX IF NOT EXISTS idx_flash_sales_active_window ON flash_sales(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_flash_sale_products_sale_id ON flash_sale_products(flash_sale_id);


-- --------------------------------------------------
-- 4.38 LOYALTY POINTS (migration 049)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS loyalty_points (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance         INTEGER     NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned INTEGER     NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id    UUID        REFERENCES orders(id) ON DELETE SET NULL,
    type        TEXT        NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'admin_adjustment')),
    points      INTEGER     NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user ON loyalty_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_user       ON loyalty_points(user_id);


-- --------------------------------------------------
-- 4.39 RETURN REQUESTS (migration 050)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS return_requests (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    buyer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason           TEXT        NOT NULL,
    reason_category  TEXT        CHECK (reason_category IN (
                       'wrong_item', 'damaged', 'not_as_described', 'changed_mind', 'other'
                     )),
    status           TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
                       'pending', 'seller_approved', 'seller_declined',
                       'refund_issued', 'admin_review', 'closed'
                     )),
    evidence_images  TEXT[],
    seller_response  TEXT,
    admin_notes      TEXT,
    refund_amount    NUMERIC(10, 2),
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order         ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_buyer         ON return_requests(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_requests_seller_status ON return_requests(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_return_requests_status        ON return_requests(status, created_at DESC);


-- --------------------------------------------------
-- 4.40 STORE BADGES (migration 054)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS store_badges (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    badge_key   TEXT        NOT NULL,
    badge_label TEXT        NOT NULL,
    awarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_store_badges_store ON store_badges(store_id);


-- --------------------------------------------------
-- 4.41 PRODUCT SIMILARITIES (migration 056)
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS product_similarities (
    product_id         UUID  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    similar_product_id UUID  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    score              FLOAT NOT NULL DEFAULT 0,
    last_computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, similar_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_similarities_lookup ON product_similarities(product_id, score DESC);


-- =====================================================
-- SECTION 5: FUNCTIONS / STORED PROCEDURES
-- =====================================================

-- update_updated_at_column: generic timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- generate_order_number: auto-generate ORD-YYYYMMDD-NNNNNN
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- create_user_profile: auto-create profile + notification prefs on new user
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

-- update_product_rating: recalculate product avg rating after review insert/update
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET
        average_rating = (SELECT AVG(rating) FROM product_reviews WHERE product_id = NEW.product_id),
        total_reviews  = (SELECT COUNT(*) FROM product_reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- update_store_rating
CREATE OR REPLACE FUNCTION update_store_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE stores
    SET
        average_rating = (SELECT AVG(rating) FROM store_reviews WHERE store_id = NEW.store_id),
        total_reviews  = (SELECT COUNT(*) FROM store_reviews WHERE store_id = NEW.store_id)
    WHERE id = NEW.store_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- update_driver_rating
CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE driver_profiles
    SET
        average_rating = (SELECT AVG(rating) FROM driver_reviews WHERE driver_id = NEW.driver_id),
        total_reviews  = (SELECT COUNT(*) FROM driver_reviews WHERE driver_id = NEW.driver_id)
    WHERE user_id = NEW.driver_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- increment_product_views (migration 006 final version)
CREATE OR REPLACE FUNCTION increment_product_views(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET view_count = view_count + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- increment_product_sales (migration 006 final version)
CREATE OR REPLACE FUNCTION increment_product_sales(product_id UUID, sale_qty INT)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET total_sales = total_sales + sale_qty
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- get_store_order_stats (migration 005)
CREATE OR REPLACE FUNCTION get_store_order_stats(
    store_id_param    UUID,
    start_date_param  TIMESTAMPTZ,
    end_date_param    TIMESTAMPTZ
)
RETURNS TABLE (
    total_orders     BIGINT,
    total_revenue    DECIMAL,
    pending_orders   BIGINT,
    completed_orders BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_revenue,
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders
    FROM orders
    WHERE store_id  = store_id_param
      AND created_at BETWEEN start_date_param AND end_date_param;
END;
$$ LANGUAGE plpgsql;

-- get_category_counts (migration 016)
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

-- Admin analytics RPCs (migration 017)
CREATE OR REPLACE FUNCTION get_admin_order_stats()
RETURNS JSONB AS $$
DECLARE v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_orders',     COUNT(id),
        'completed_orders', COUNT(id) FILTER (WHERE status = 'completed'),
        'pending_orders',   COUNT(id) FILTER (WHERE status = 'pending'),
        'cancelled_orders', COUNT(id) FILTER (WHERE status = 'cancelled'),
        'total_revenue',    COALESCE(SUM(total_amount) FILTER (WHERE status IN (
                                'paid','confirmed','ready_for_pickup','assigned',
                                'picked_up','in_transit','delivered','completed'
                            )), 0)
    ) INTO v_stats FROM orders;
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_admin_product_stats()
RETURNS JSONB AS $$
DECLARE v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_products',       COUNT(p.id),
        'active_products',      COUNT(p.id) FILTER (WHERE p.is_active = TRUE),
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
DECLARE v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_reviews',  COUNT(id),
        'average_rating', COALESCE(AVG(rating), 0)
    ) INTO v_stats FROM product_reviews;
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql;

-- ensure_single_default_payment_method (migration 012)
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE user_payment_methods
        SET is_default = FALSE
        WHERE user_id = NEW.user_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- cleanup_expired_refresh_tokens (migration 013)
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '30 days'
       OR (is_revoked = TRUE AND revoked_at < NOW() - INTERVAL '7 days');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- create_order_atomic (migration 046 final: SELECT FOR UPDATE version)
CREATE OR REPLACE FUNCTION create_order_atomic(
    p_order_number   TEXT,
    p_buyer_id       UUID,
    p_store_id       UUID,
    p_subtotal       NUMERIC,
    p_tax            NUMERIC,
    p_delivery_fee   NUMERIC,
    p_total_amount   NUMERIC,
    p_delivery_address TEXT,
    p_delivery_city  TEXT,
    p_delivery_country TEXT,
    p_delivery_phone TEXT,
    p_delivery_notes TEXT,
    p_payment_method TEXT,
    p_items          JSONB
) RETURNS JSONB AS $$
DECLARE
    v_order_id   UUID;
    v_item       JSONB;
    v_available  INT;
    v_payment_id UUID;
    v_requested  INT;
BEGIN
    -- 1. Lock each inventory row and verify stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_requested := (v_item->>'quantity')::INT;

        SELECT quantity INTO v_available
        FROM inventory
        WHERE product_id = (v_item->>'product_id')::UUID
        FOR UPDATE;

        IF v_available IS NULL THEN
            RAISE EXCEPTION 'Product % not found in inventory', v_item->>'product_title';
        END IF;

        IF v_available < v_requested THEN
            RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %',
                v_item->>'product_title', v_requested, v_available;
        END IF;

        UPDATE inventory
        SET quantity   = quantity - v_requested,
            updated_at = NOW()
        WHERE product_id = (v_item->>'product_id')::UUID;
    END LOOP;

    -- 2. Insert order
    INSERT INTO orders (
        order_number, buyer_id, store_id, status,
        subtotal, tax, delivery_fee, total_amount,
        delivery_address_line1, delivery_city, delivery_country,
        delivery_phone, buyer_notes
    ) VALUES (
        p_order_number, p_buyer_id, p_store_id, 'pending',
        p_subtotal, p_tax, p_delivery_fee, p_total_amount,
        p_delivery_address, p_delivery_city, COALESCE(p_delivery_country, 'Ghana'),
        p_delivery_phone, p_delivery_notes
    ) RETURNING id INTO v_order_id;

    -- 3. Insert order items
    INSERT INTO order_items (order_id, product_id, product_title, quantity, price, subtotal)
    SELECT
        v_order_id,
        (item->>'product_id')::UUID,
        item->>'product_title',
        (item->>'quantity')::INT,
        (item->>'price')::NUMERIC,
        (item->>'subtotal')::NUMERIC
    FROM jsonb_array_elements(p_items) AS item;

    -- 4. Insert payment record
    INSERT INTO payments (order_id, payment_method, amount, status)
    VALUES (v_order_id, p_payment_method::payment_method, p_total_amount, 'pending')
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object(
        'id',           v_order_id,
        'payment_id',   v_payment_id,
        'order_number', p_order_number,
        'status',       'pending',
        'total_amount', p_total_amount
    );
END;
$$ LANGUAGE plpgsql;

-- record_promotion_impression (migration 031 final version)
CREATE OR REPLACE FUNCTION record_promotion_impression(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_cost      NUMERIC := 0.01;
    v_new_spent NUMERIC;
    v_budget    NUMERIC;
BEGIN
    UPDATE promoted_products
    SET
        impressions       = impressions + 1,
        total_impressions = total_impressions + 1,
        spent_amount      = spent_amount + v_cost,
        budget_spent      = budget_spent + v_cost,
        updated_at        = NOW()
    WHERE id = p_campaign_id
    RETURNING spent_amount, budget INTO v_new_spent, v_budget;

    IF v_new_spent >= v_budget THEN
        UPDATE promoted_products
        SET status    = 'paused',
            is_active = FALSE
        WHERE id = p_campaign_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- record_promotion_click (migration 031 final version)
CREATE OR REPLACE FUNCTION record_promotion_click(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_cost      NUMERIC;
    v_new_spent NUMERIC;
    v_budget    NUMERIC;
BEGIN
    SELECT cost_per_click INTO v_cost
    FROM promoted_products WHERE id = p_campaign_id;

    UPDATE promoted_products
    SET
        clicks       = clicks + 1,
        total_clicks = total_clicks + 1,
        spent_amount = spent_amount + COALESCE(v_cost, 0.10),
        budget_spent = budget_spent + COALESCE(v_cost, 0.10),
        updated_at   = NOW()
    WHERE id = p_campaign_id
    RETURNING spent_amount, budget INTO v_new_spent, v_budget;

    IF v_new_spent >= v_budget THEN
        UPDATE promoted_products
        SET status    = 'paused',
            is_active = FALSE
        WHERE id = p_campaign_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Review community helpers (migration 019)
CREATE OR REPLACE FUNCTION increment_review_likes(target_review_id UUID, target_type review_type)
RETURNS VOID AS $$
BEGIN
    IF target_type = 'product' THEN
        UPDATE product_reviews SET likes_count = likes_count + 1 WHERE id = target_review_id;
    ELSIF target_type = 'store' THEN
        UPDATE store_reviews SET likes_count = likes_count + 1 WHERE id = target_review_id;
    ELSIF target_type = 'driver' THEN
        UPDATE driver_reviews SET likes_count = likes_count + 1 WHERE id = target_review_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_review_likes(target_review_id UUID, target_type review_type)
RETURNS VOID AS $$
BEGIN
    IF target_type = 'product' THEN
        UPDATE product_reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_review_id;
    ELSIF target_type = 'store' THEN
        UPDATE store_reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_review_id;
    ELSIF target_type = 'driver' THEN
        UPDATE driver_reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = target_review_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- trg_sync_is_in_stock: keeps products.is_in_stock in sync with inventory (migration 046)
CREATE OR REPLACE FUNCTION trg_sync_is_in_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.allow_backorder = TRUE THEN
        UPDATE products SET is_in_stock = TRUE WHERE id = NEW.product_id;
        RETURN NEW;
    END IF;

    IF NEW.quantity <= 0 THEN
        UPDATE products SET is_in_stock = FALSE WHERE id = NEW.product_id;
    ELSE
        UPDATE products SET is_in_stock = TRUE  WHERE id = NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- confirm_delivery_atomic (migration 035)
CREATE OR REPLACE FUNCTION confirm_delivery_atomic(
    p_order_id UUID,
    p_user_id  UUID,
    p_is_admin BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_order             RECORD;
    v_store             RECORD;
    v_seller_payout     DECIMAL(12, 2);
    v_driver_payout     DECIMAL(12, 2);
    v_platform_fee      DECIMAL(12, 2);
    v_new_store_balance DECIMAL(12, 2);
    v_new_driver_balance DECIMAL(12, 2);
    v_now               TIMESTAMPTZ := NOW();
    v_delivery          RECORD;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    IF NOT p_is_admin AND v_order.buyer_id != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_order.escrow_status != 'HELD' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Funds are not held in escrow');
    END IF;

    SELECT * INTO v_store    FROM stores     WHERE id       = v_order.store_id FOR UPDATE;
    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id       FOR UPDATE;

    v_seller_payout := v_order.subtotal * 0.95;

    IF v_delivery.id IS NOT NULL AND v_delivery.driver_id IS NOT NULL THEN
        v_driver_payout := v_order.delivery_fee * 0.85;
    ELSE
        v_driver_payout := 0;
    END IF;

    v_platform_fee := v_order.total_amount - v_seller_payout - v_driver_payout;

    UPDATE orders SET
        status               = 'completed',
        escrow_status        = 'RELEASED',
        platform_fee         = v_platform_fee,
        seller_payout_amount = v_seller_payout,
        payout_released_at   = v_now,
        updated_at           = v_now
    WHERE id = p_order_id;

    v_new_store_balance := COALESCE(v_store.current_balance, 0) + v_seller_payout;
    UPDATE stores SET current_balance = v_new_store_balance WHERE id = v_store.id;
    INSERT INTO balance_logs (store_id, amount, transaction_type, order_id, balance_after)
    VALUES (v_store.id, v_seller_payout, 'sale', p_order_id, v_new_store_balance);

    IF v_driver_payout > 0 THEN
        UPDATE user_profiles SET
            wallet_balance = COALESCE(wallet_balance, 0) + v_driver_payout,
            updated_at     = v_now
        WHERE user_id = v_delivery.driver_id;

        SELECT wallet_balance INTO v_new_driver_balance
        FROM user_profiles WHERE user_id = v_delivery.driver_id;

        INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after)
        VALUES (v_delivery.driver_id, v_driver_payout, 'earning', p_order_id, v_new_driver_balance);

        UPDATE deliveries SET
            status         = 'delivered',
            delivered_at   = v_now,
            driver_earnings = v_driver_payout,
            updated_at     = v_now
        WHERE id = v_delivery.id;
    END IF;

    -- Handle referral reward atomically
    DECLARE
        v_referral       RECORD;
        v_referrer_wallet DECIMAL(12, 2);
    BEGIN
        SELECT * INTO v_referral FROM referrals
        WHERE referred_id = v_order.buyer_id AND status = 'pending'
        LIMIT 1 FOR UPDATE;

        IF FOUND THEN
            UPDATE referrals SET
                status       = 'completed',
                order_id     = p_order_id,
                completed_at = v_now
            WHERE id = v_referral.id;

            UPDATE user_profiles SET
                wallet_balance = COALESCE(wallet_balance, 0) + v_referral.reward_amount,
                updated_at     = v_now
            WHERE user_id = v_referral.referrer_id;

            SELECT wallet_balance INTO v_referrer_wallet
            FROM user_profiles WHERE user_id = v_referral.referrer_id;

            INSERT INTO wallet_logs (user_id, amount, transaction_type, order_id, balance_after)
            VALUES (v_referral.referrer_id, v_referral.reward_amount, 'referral_reward', p_order_id, v_referrer_wallet);
        END IF;
    END;

    RETURN jsonb_build_object(
        'success',       true,
        'message',       'Delivery confirmed and funds released',
        'seller_payout', v_seller_payout,
        'driver_payout', v_driver_payout,
        'platform_fee',  v_platform_fee
    );
END;
$$ LANGUAGE plpgsql;

-- verify_delivery_pin (migration 035)
CREATE OR REPLACE FUNCTION verify_delivery_pin(
    p_order_id  UUID,
    p_driver_id UUID,
    p_pin       VARCHAR(6)
) RETURNS JSONB AS $$
DECLARE
    v_order    RECORD;
    v_delivery RECORD;
BEGIN
    SELECT * INTO v_order    FROM orders     WHERE id       = p_order_id FOR UPDATE;
    SELECT * INTO v_delivery FROM deliveries WHERE order_id = p_order_id FOR UPDATE;

    IF v_order.id IS NULL OR v_delivery.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order or delivery not found');
    END IF;

    IF v_delivery.driver_id != p_driver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not the assigned driver for this order');
    END IF;

    IF v_order.verification_pin IS NULL OR v_order.verification_pin != p_pin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid verification PIN');
    END IF;

    UPDATE orders SET
        pin_verified_at   = NOW(),
        verification_pin  = NULL
    WHERE id = p_order_id;

    RETURN confirm_delivery_atomic(p_order_id, v_order.buyer_id, TRUE);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- SECTION 6: TRIGGERS
-- =====================================================

-- updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at
    BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
    BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Order number auto-generation
CREATE TRIGGER generate_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- Auto-create user profile + notification prefs on new user
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Rating recalculation
CREATE TRIGGER update_product_rating_trigger
    AFTER INSERT OR UPDATE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();

CREATE TRIGGER update_store_rating_trigger
    AFTER INSERT OR UPDATE ON store_reviews
    FOR EACH ROW EXECUTE FUNCTION update_store_rating();

CREATE TRIGGER update_driver_rating_trigger
    AFTER INSERT OR UPDATE ON driver_reviews
    FOR EACH ROW EXECUTE FUNCTION update_driver_rating();

-- Single default payment method (migration 012)
CREATE TRIGGER trigger_single_default_payment_method
    BEFORE INSERT OR UPDATE OF is_default ON user_payment_methods
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_payment_method();

-- Stock visibility sync (migration 046)
DROP TRIGGER IF EXISTS trg_inventory_stock_status ON inventory;
CREATE TRIGGER trg_inventory_stock_status
    AFTER INSERT OR UPDATE OF quantity, allow_backorder ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION trg_sync_is_in_stock();


-- =====================================================
-- SECTION 7: SEED DATA
-- =====================================================

-- Default roles
INSERT INTO roles (id, name, display_name, description) VALUES
    (uuid_generate_v4(), 'buyer',  'Buyer',  'Can browse products, make purchases, and leave reviews'),
    (uuid_generate_v4(), 'seller', 'Seller', 'Can create stores, list products, and manage orders'),
    (uuid_generate_v4(), 'driver', 'Driver', 'Can accept and complete delivery assignments')
ON CONFLICT (name) DO NOTHING;

-- Default categories (migration 007)
INSERT INTO categories (name, slug, description, is_active) VALUES
    ('Electronics',   'electronics',   'Devices, gadgets, and accessories',       TRUE),
    ('Fashion',       'fashion',       'Clothing, shoes, and jewelry',             TRUE),
    ('Home & Kitchen','home-kitchen',  'Furniture, appliances, and decor',         TRUE),
    ('Beauty',        'beauty',        'Makeup, skincare, and fragrance',          TRUE),
    ('Sports',        'sports',        'Gear, apparel, and equipment',             TRUE),
    ('Books',         'books',         'Books, textbooks, and magazines',          TRUE),
    ('Toys',          'toys',          'Games, puzzles, and toys',                 TRUE),
    ('Health',        'health',        'Supplements, first aid, and wellness',     TRUE),
    ('Automotive',    'automotive',    'Parts, accessories, and tools',            TRUE),
    ('Grocery',       'grocery',       'Food, beverages, and household staples',   TRUE),
    ('Art',           'art',           'Paintings, sculptures, and crafts',        TRUE),
    ('Other',         'other',         'Miscellaneous items',                      TRUE)
ON CONFLICT (name) DO NOTHING;

-- Support system user (migration 034)
INSERT INTO users (id, email, password_hash, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'support@shopyos.com',
    'NOT_A_REAL_PASSWORD_DO_NOT_LOGIN',
    true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_profiles (user_id, full_name, phone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Shopyos Support', '+0000000000')
ON CONFLICT (user_id) DO NOTHING;


-- =====================================================
-- SECTION 8: TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE users              IS 'Core user accounts with authentication credentials';
COMMENT ON TABLE user_profiles      IS 'Extended user profile information';
COMMENT ON TABLE roles              IS 'System roles: buyer, seller, driver, admin';
COMMENT ON TABLE user_roles         IS 'Many-to-many relationship between users and roles';
COMMENT ON TABLE stores             IS 'Seller storefronts';
COMMENT ON TABLE products           IS 'Product listings';
COMMENT ON TABLE inventory          IS 'Product stock management';
COMMENT ON TABLE carts              IS 'User shopping carts';
COMMENT ON TABLE orders             IS 'Purchase orders';
COMMENT ON TABLE payments           IS 'Payment transactions';
COMMENT ON TABLE deliveries         IS 'Delivery assignments and tracking';
COMMENT ON TABLE messages           IS 'In-app messaging between users';
COMMENT ON TABLE notifications      IS 'System notifications';
COMMENT ON TABLE favorites          IS 'User product favorites/wishlist';
COMMENT ON TABLE categories         IS 'Product categories';
COMMENT ON TABLE flash_sales        IS 'Time-limited flash sale campaigns';
COMMENT ON TABLE loyalty_points     IS 'Per-user loyalty point balances';
COMMENT ON TABLE loyalty_transactions IS 'Full ledger of loyalty point events';
COMMENT ON TABLE return_requests    IS 'Buyer return/refund requests';
COMMENT ON TABLE product_variants   IS 'SKU-level product variants (size, colour, etc.)';
COMMENT ON TABLE product_waitlist   IS 'Back-in-stock and pre-order notification list';
COMMENT ON TABLE store_badges       IS 'Seller badges awarded by nightly cron evaluation';
COMMENT ON TABLE promo_codes        IS 'Discount / promo codes (platform-wide or store-specific)';
COMMENT ON TABLE product_similarities IS 'Pre-computed item-item collaborative filtering scores';

COMMENT ON COLUMN stores.delivery_base_fee   IS 'Flat delivery fee charged per order regardless of distance (₵)';
COMMENT ON COLUMN stores.delivery_per_km_fee IS 'Additional fee per km of straight-line distance (₵/km)';
COMMENT ON COLUMN stores.delivery_max_km     IS 'Max delivery radius in km. NULL means seller delivers anywhere.';
COMMENT ON COLUMN notifications.data         IS 'Additional metadata for the notification (e.g., orderId, orderNumber, amounts)';

-- =====================================================
-- END OF CONSOLIDATED SCHEMA
-- =====================================================
