-- Migration to add 'preparing' to order_status enum
-- This is needed for the seller dashboard order flow

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing' AFTER 'confirmed';
