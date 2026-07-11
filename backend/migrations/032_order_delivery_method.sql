-- 032: buyers can choose store pickup at checkout instead of paid delivery
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) NOT NULL DEFAULT 'delivery';
