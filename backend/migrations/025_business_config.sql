-- Migration 025: Business Configuration Parameters
-- Extends platform_fee_config with all configurable business values
-- Previously hardcoded values are now managed via feeConfigService

INSERT INTO platform_fee_config (config_key, config_value, config_type, category, label, description, min_value, max_value) VALUES

-- Store management
('free_listing_limit',          100, 'integer',   'stores',      'Free Listing Limit',                    'Max products a free-tier store can list',               1,   1000),
('default_low_stock_threshold', 10,  'integer',   'stores',      'Low Stock Threshold',                   'Default threshold for low stock alerts',                 1,   1000),
('max_images_per_product',      5,   'integer',   'products',    'Max Images Per Product',                'Maximum images allowed per product listing',             1,   50),
('listing_fee_amount',          50,  'fixed',     'stores',      'Listing Fee Amount (GHS)',              'One-time fee to activate a paid store listing',          1,   500),

-- Tax & fees
('default_tax_amount',          1,   'fixed',     'orders',      'Default Tax Amount (GHS)',              'Flat tax charged per order',                             0,   100),

-- Orders
('cancel_window_minutes',       5,   'integer',   'orders',      'Cancel Window (Minutes)',               'Minutes after placing an order during which cancellation is allowed', 1, 1440),
('driver_notification_radius_km', 10, 'integer',  'delivery',    'Driver Notification Radius (KM)',       'Radius to notify drivers for new deliveries',            1,   100),

-- Loyalty
('loyalty_points_per_currency', 1,   'integer',   'loyalty',     'Points Earned Per GHS',                 'Points earned for every GHS 1 spent',                    1,   100),
('loyalty_points_to_currency',  100, 'integer',   'loyalty',     'Points Per GHS Discount',               'Points needed for GHS 1 discount',                       1,   10000),
('loyalty_max_redeem_percent',  20,  'percentage','loyalty',     'Max Redeem Percentage',                 'Maximum percentage of subtotal redeemable with points',  1,   100),

-- Referrals
('referral_reward_amount',      20,  'fixed',     'referrals',   'Referral Reward Amount (GHS)',          'Amount credited for successful referral',                1,   500),

-- Auth
('access_token_expiry_minutes', 15,  'integer',   'auth',        'Access Token Expiry (Minutes)',         'JWT access token lifetime',                              1,   1440),
('refresh_token_expiry_days',   7,   'integer',   'auth',        'Refresh Token Expiry (Days)',           'Refresh token lifetime',                                 1,   365),

-- Payouts
('min_driver_payout_amount',    10,  'fixed',     'payout',      'Min Driver Payout Amount (GHS)',        'Minimum balance before driver can request payout',       1,   500),

-- Transit
('default_transit_days_min',    2,   'integer',   'delivery',    'Default Transit Days Min',              'Min transit days for inter-regional delivery',           1,   30),

-- Caching
('cache_ttl_default_seconds',   300, 'integer',   'performance', 'Default Cache TTL (Seconds)',           'Default TTL for Redis cache entries',                    1,   86400),
('fee_config_cache_ttl_seconds',300, 'integer',   'performance', 'Fee Config Cache TTL (Seconds)',        'TTL for fee config cache',                               1,   3600),

-- Observability
('slow_request_threshold_ms',   1000,'integer',   'performance', 'Slow Request Threshold (MS)',           'Duration above which a request is logged as slow',       100,  60000),
('memory_warning_threshold_mb', 256, 'integer',   'performance', 'Memory Warning Threshold (MB)',         'Heap usage above this triggers a warning',               50,   4096),
('in_memory_log_cap',           200, 'integer',   'performance', 'In-Memory Log Cap',                     'Max in-memory log entries before rotation',              10,   10000),

-- Workers
('worker_batch_size',           50,  'integer',   'workers',     'Worker Batch Size',                     'Items processed per batch in background workers',        10,   1000),
('worker_page_size',            500, 'integer',   'workers',     'Worker Page Size',                      'Page size for worker queries',                           50,   5000),
('receipt_batch_size',          300, 'integer',   'workers',     'Receipt Batch Size',                    'Batch size for receipt polling',                         10,   10000)

ON CONFLICT (config_key) DO NOTHING;
