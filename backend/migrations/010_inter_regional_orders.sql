-- Ghana regions reference table
CREATE TABLE IF NOT EXISTS ghana_regions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    code        VARCHAR(10)  UNIQUE NOT NULL,
    capital     VARCHAR(100),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Parcel Partner Hubs (distributor-agnostic)
CREATE TABLE IF NOT EXISTS parcel_partner_hubs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id       INTEGER NOT NULL REFERENCES ghana_regions(id),
    hub_name        VARCHAR(255) NOT NULL,
    partner_name    VARCHAR(255) DEFAULT 'Default Partner',
    address         TEXT NOT NULL,
    phone           VARCHAR(20),
    latitude        DECIMAL(10,8),
    longitude       DECIMAL(11,8),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Parcel Partner Transit Config
CREATE TABLE IF NOT EXISTS parcel_transit_config (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_region   VARCHAR(100) NOT NULL,
    dest_region     VARCHAR(100) NOT NULL,
    transit_days_min INTEGER NOT NULL DEFAULT 2,
    transit_days_max INTEGER NOT NULL DEFAULT 5,
    route_fee       DECIMAL(10,2) NOT NULL DEFAULT 25.00,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (origin_region, dest_region)
);

-- Extend order_status enum
DO $$
BEGIN
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'at_origin_hub';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_transit_regional';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'at_destination_hub';
    ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_last_mile';
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Extend orders table
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_type              VARCHAR(30) DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS origin_region           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS destination_region      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS origin_hub_id           UUID REFERENCES parcel_partner_hubs(id),
    ADD COLUMN IF NOT EXISTS destination_hub_id      UUID REFERENCES parcel_partner_hubs(id),
    ADD COLUMN IF NOT EXISTS parcel_tracking_number  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS parcel_transit_fee      DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_hub_arrival   DATE,
    ADD COLUMN IF NOT EXISTS last_mile_requested     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_mile_fee           DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_mile_delivery_id   UUID;

-- Alter valid_role_name constraint on roles table to support parcel_partner role
ALTER TABLE roles DROP CONSTRAINT IF EXISTS valid_role_name;
ALTER TABLE roles ADD CONSTRAINT valid_role_name CHECK (name IN ('buyer', 'seller', 'driver', 'admin', 'parcel_partner'));

-- Parcel Partner user role
INSERT INTO roles (id, name, display_name, description)
VALUES (uuid_generate_v4(), 'parcel_partner', 'Parcel Partner', 'Partner logistics staff who manage hub operations')
ON CONFLICT (name) DO NOTHING;

-- Parcel status update log
CREATE TABLE IF NOT EXISTS parcel_status_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status          VARCHAR(50) NOT NULL,
    hub_id          UUID REFERENCES parcel_partner_hubs(id),
    updated_by      UUID NOT NULL REFERENCES users(id),
    notes           TEXT,
    photo_url       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcel_status_log_order ON parcel_status_log(order_id, created_at DESC);

-- Seed Ghana regions
INSERT INTO ghana_regions (name, code, capital) VALUES
('Greater Accra', 'GAR', 'Accra'),
('Ashanti',       'ASH', 'Kumasi'),
('Western',       'WES', 'Sekondi-Takoradi'),
('Eastern',       'EAS', 'Koforidua'),
('Central',       'CEN', 'Cape Coast'),
('Northern',      'NOR', 'Tamale'),
('Volta',         'VOL', 'Ho'),
('Upper East',    'UPE', 'Bolgatanga'),
('Upper West',    'UPW', 'Wa'),
('Brong-Ahafo',   'BAH', 'Sunyani'),
('Oti',           'OTI', 'Dambai'),
('Bono East',     'BOE', 'Techiman'),
('Ahafo',         'AHF', 'Goaso'),
('Savannah',      'SAV', 'Damongo'),
('North East',    'NEA', 'Nalerigu'),
('Western North', 'WEN', 'Sefwi Wiawso')
ON CONFLICT (name) DO NOTHING;

-- Seed some default parcel partner hubs for main capitals
-- First fetch Greater Accra and Ashanti region IDs using subqueries
INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Accra Central Transit Hub', 'Parcel Partner Ltd', 'VIP Parcel Terminal, Circle, Accra', '0241234567', 5.5600, -0.2050
FROM ghana_regions WHERE name = 'Greater Accra'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Kumasi Central Transit Hub', 'Parcel Partner Ltd', 'VIP Parcel Terminal, Adum, Kumasi', '0247654321', 6.6900, -1.6200
FROM ghana_regions WHERE name = 'Ashanti'
ON CONFLICT DO NOTHING;
