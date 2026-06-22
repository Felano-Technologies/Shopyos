-- ============================================================
-- Migration 008: Database Views
-- 14 views covering the most complex/repeated JOIN patterns.
-- All use CREATE OR REPLACE VIEW so re-running is safe.
-- ============================================================

-- 1. vw_user_profile
-- users + user_profiles + active roles array (excludes soft-deleted users)
CREATE OR REPLACE VIEW vw_user_profile AS
SELECT
  u.id,
  u.email,
  u.is_active,
  u.created_at,
  up.full_name,
  up.phone,
  up.avatar_url,
  up.latitude,
  up.longitude,
  up.wallet_balance,
  up.onboarding_state,
  (
    SELECT array_agg(r.name)
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND ur.is_active = TRUE
  ) AS roles
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.id
WHERE u.deleted_at IS NULL;

-- 2. vw_product_listing
-- products + store info + primary image + available stock (active only)
CREATE OR REPLACE VIEW vw_product_listing AS
SELECT
  p.id,
  p.title,
  p.price,
  p.compare_at_price,
  p.category,
  p.subcategory,
  p.average_rating,
  p.total_reviews,
  p.total_sales,
  p.view_count,
  p.is_promoted,
  p.tags,
  p.attributes,
  p.gender,
  p.store_id,
  p.created_at,
  s.store_name,
  s.slug         AS store_slug,
  s.is_verified  AS store_verified,
  s.logo_url     AS store_logo,
  pi.image_url   AS primary_image,
  COALESCE(inv.quantity, 0) - COALESCE(inv.reserved_quantity, 0) AS available_stock
FROM products p
JOIN stores s ON s.id = p.store_id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
LEFT JOIN inventory inv ON inv.product_id = p.id
WHERE p.deleted_at IS NULL
  AND p.is_active = TRUE
  AND s.is_active = TRUE;

-- 3. vw_store_summary
-- stores + owner name/email + product count + follower count
CREATE OR REPLACE VIEW vw_store_summary AS
SELECT
  s.id,
  s.store_name,
  s.slug,
  s.logo_url,
  s.banner_url,
  s.category,
  s.is_verified,
  s.is_active,
  s.is_featured,
  s.average_rating,
  s.total_reviews,
  s.total_sales,
  s.current_balance,
  s.verification_status,
  s.owner_id,
  up.full_name   AS owner_name,
  up.phone       AS owner_phone,
  u.email        AS owner_email,
  (SELECT COUNT(*) FROM products p WHERE p.store_id = s.id AND p.deleted_at IS NULL)::int AS product_count,
  (SELECT COUNT(*) FROM store_follows sf WHERE sf.store_id = s.id)::int AS follower_count
FROM stores s
JOIN users u ON u.id = s.owner_id
LEFT JOIN user_profiles up ON up.user_id = s.owner_id;

-- 4. vw_order_summary
-- orders + buyer profile + store name + payment status + delivery status
CREATE OR REPLACE VIEW vw_order_summary AS
SELECT
  o.id,
  o.order_number,
  o.status,
  o.subtotal,
  o.delivery_fee,
  o.total_amount,
  o.discount_amount,
  o.loyalty_points_used,
  o.escrow_status,
  o.delivery_address_line1,
  o.delivery_city,
  o.delivery_country,
  o.created_at,
  o.paid_at,
  o.buyer_id,
  o.store_id,
  up.full_name   AS buyer_name,
  up.phone       AS buyer_phone,
  u.email        AS buyer_email,
  s.store_name,
  s.logo_url     AS store_logo,
  pay.status     AS payment_status,
  pay.payment_method,
  d.status       AS delivery_status,
  d.driver_id
FROM orders o
JOIN users u ON u.id = o.buyer_id
LEFT JOIN user_profiles up ON up.user_id = o.buyer_id
JOIN stores s ON s.id = o.store_id
LEFT JOIN payments pay ON pay.order_id = o.id
LEFT JOIN deliveries d ON d.order_id = o.id;

-- 5. vw_available_drivers
-- verified + available driver_profiles with user contact info and location
CREATE OR REPLACE VIEW vw_available_drivers AS
SELECT
  dp.id          AS driver_profile_id,
  dp.user_id,
  dp.vehicle_type,
  dp.average_rating,
  dp.total_deliveries,
  dp.is_available,
  u.email,
  up.full_name,
  up.phone,
  up.latitude,
  up.longitude,
  up.avatar_url
FROM driver_profiles dp
JOIN users u ON u.id = dp.user_id
LEFT JOIN user_profiles up ON up.user_id = dp.user_id
WHERE dp.is_available = TRUE
  AND dp.is_verified = TRUE
  AND u.is_active = TRUE
  AND u.deleted_at IS NULL;

-- 6. vw_return_request_detail
-- return_requests + buyer profile + order number + store name
CREATE OR REPLACE VIEW vw_return_request_detail AS
SELECT
  rr.id,
  rr.status,
  rr.reason,
  rr.reason_category,
  rr.evidence_images,
  rr.seller_response,
  rr.admin_notes,
  rr.refund_amount,
  rr.created_at,
  rr.resolved_at,
  rr.order_id,
  o.order_number,
  o.total_amount  AS order_total,
  rr.buyer_id,
  up.full_name    AS buyer_name,
  u.email         AS buyer_email,
  rr.seller_id,
  o.store_id,
  s.store_name
FROM return_requests rr
JOIN orders o ON o.id = rr.order_id
JOIN users u ON u.id = rr.buyer_id
LEFT JOIN user_profiles up ON up.user_id = rr.buyer_id
JOIN stores s ON s.id = o.store_id;

-- 7. vw_conversation_summary
-- conversations + both participant profiles + last message + unread count
CREATE OR REPLACE VIEW vw_conversation_summary AS
SELECT
  c.id,
  c.order_id,
  c.is_support,
  c.participant1_id,
  up1.full_name   AS participant1_name,
  up1.avatar_url  AS participant1_avatar,
  c.participant2_id,
  up2.full_name   AS participant2_name,
  up2.avatar_url  AS participant2_avatar,
  (SELECT content    FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_message,
  (SELECT sender_id  FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_message_sender,
  (SELECT created_at FROM messages WHERE conversation_id = c.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS last_message_at,
  (SELECT COUNT(*)   FROM messages WHERE conversation_id = c.id AND is_read = FALSE AND deleted_at IS NULL)::int AS unread_count
FROM conversations c
LEFT JOIN user_profiles up1 ON up1.user_id = c.participant1_id
LEFT JOIN user_profiles up2 ON up2.user_id = c.participant2_id;

-- 8. vw_audit_log_with_actor
-- audit_logs + actor full name + email + active role
CREATE OR REPLACE VIEW vw_audit_log_with_actor AS
SELECT
  al.id,
  al.action,
  al.entity_type,
  al.entity_id,
  al.status,
  al.ip_address,
  al.metadata,
  al.timestamp,
  al.user_id,
  up.full_name   AS actor_name,
  u.email        AS actor_email,
  r.name         AS actor_role
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
LEFT JOIN user_profiles up ON up.user_id = al.user_id
LEFT JOIN user_roles ur ON ur.user_id = al.user_id AND ur.is_active = TRUE
LEFT JOIN roles r ON r.id = ur.role_id;

-- 9. vw_active_snap_feed
-- non-expired snaps with store info
CREATE OR REPLACE VIEW vw_active_snap_feed AS
SELECT
  sn.id,
  sn.media_url,
  sn.caption,
  sn.view_count,
  sn.expires_at,
  sn.created_at,
  sn.product_id,
  sn.store_id,
  s.store_name,
  s.logo_url     AS store_logo,
  s.slug         AS store_slug,
  s.is_verified  AS store_verified
FROM snaps sn
JOIN stores s ON s.id = sn.store_id
WHERE sn.expires_at > NOW()
  AND s.is_active = TRUE;

-- 10. vw_banner_campaign_detail
-- banner_campaigns + store name + product title
CREATE OR REPLACE VIEW vw_banner_campaign_detail AS
SELECT
  bc.id,
  bc.title,
  bc.status,
  bc.placement,
  bc.banner_url,
  bc.clicks,
  bc.impressions,
  bc.paid_amount,
  bc.start_date,
  bc.end_date,
  bc.admin_created,
  bc.store_id,
  s.store_name,
  s.logo_url     AS store_logo,
  bc.product_id,
  p.title        AS product_title
FROM banner_campaigns bc
JOIN stores s ON s.id = bc.store_id
LEFT JOIN products p ON p.id = bc.product_id;

-- 11. vw_cart_detail
-- carts + cart_items + products + primary image + store name
CREATE OR REPLACE VIEW vw_cart_detail AS
SELECT
  c.id           AS cart_id,
  c.user_id,
  c.last_activity,
  ci.id          AS item_id,
  ci.quantity,
  ci.price_at_add,
  p.id           AS product_id,
  p.title,
  p.price        AS current_price,
  p.store_id,
  s.store_name,
  pi.image_url   AS product_image
FROM carts c
JOIN cart_items ci ON ci.cart_id = c.id
JOIN products p ON p.id = ci.product_id
JOIN stores s ON s.id = p.store_id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
WHERE p.deleted_at IS NULL;

-- 12. vw_flash_sale_active
-- currently running flash sales with product details
CREATE OR REPLACE VIEW vw_flash_sale_active AS
SELECT
  fs.id          AS sale_id,
  fs.title       AS sale_title,
  fs.starts_at,
  fs.ends_at,
  fsp.id         AS sale_product_id,
  fsp.flash_price,
  fsp.stock_limit,
  fsp.sold_count,
  p.id           AS product_id,
  p.title,
  p.price        AS original_price,
  p.average_rating,
  p.store_id,
  pi.image_url   AS product_image,
  s.store_name
FROM flash_sales fs
JOIN flash_sale_products fsp ON fsp.flash_sale_id = fs.id
JOIN products p ON p.id = fsp.product_id
JOIN stores s ON s.id = p.store_id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
WHERE fs.is_active = TRUE
  AND fs.ends_at > NOW()
  AND fs.starts_at <= NOW()
  AND p.deleted_at IS NULL;

-- 13. vw_promoted_product_detail
-- active promoted product campaigns with product and store info
CREATE OR REPLACE VIEW vw_promoted_product_detail AS
SELECT
  pp.id          AS campaign_id,
  pp.budget,
  pp.spent_amount,
  pp.cost_per_click,
  pp.impressions,
  pp.clicks,
  pp.total_conversions,
  pp.status,
  pp.start_date,
  pp.end_date,
  p.id           AS product_id,
  p.title,
  p.price,
  p.category,
  p.average_rating,
  pi.image_url   AS product_image,
  s.id           AS store_id,
  s.store_name,
  s.is_verified  AS store_verified
FROM promoted_products pp
JOIN products p ON p.id = pp.product_id
JOIN stores s ON s.id = pp.store_id
LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = TRUE
WHERE pp.is_active = TRUE
  AND p.deleted_at IS NULL;

-- 14. vw_payout_detail
-- payouts + store name + owner profile
CREATE OR REPLACE VIEW vw_payout_detail AS
SELECT
  py.id,
  py.amount,
  py.status,
  py.payout_method,
  py.payout_details,
  py.transaction_reference,
  py.admin_notes,
  py.processed_at,
  py.created_at,
  py.store_id,
  s.store_name,
  s.owner_id,
  up.full_name   AS owner_name,
  u.email        AS owner_email
FROM payouts py
JOIN stores s ON s.id = py.store_id
JOIN users u ON u.id = s.owner_id
LEFT JOIN user_profiles up ON up.user_id = s.owner_id;
