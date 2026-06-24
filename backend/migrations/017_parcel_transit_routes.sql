-- Migration 017: Seed realistic Ghana inter-regional parcel transit routes
-- Fees (GHS) and transit days based on actual road distances and courier rates.
-- All routes are bidirectional — both (A→B) and (B→A) rows are inserted.

-- Extend parcel_partner_hubs for all 16 region capitals
-- (Greater Accra and Ashanti already seeded in 010)
INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Takoradi Transit Hub', 'Parcel Partner Ltd', 'VIP Bus Terminal, Market Circle, Takoradi', '0208000011', 4.8968, -1.7558
FROM ghana_regions WHERE name = 'Western'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Koforidua Transit Hub', 'Parcel Partner Ltd', 'Juaben Bus Station, Koforidua', '0208000012', 6.0941, -0.2613
FROM ghana_regions WHERE name = 'Eastern'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Cape Coast Transit Hub', 'Parcel Partner Ltd', 'STC Bus Terminal, Cape Coast', '0208000013', 5.1037, -1.2808
FROM ghana_regions WHERE name = 'Central'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Tamale Transit Hub', 'Parcel Partner Ltd', 'VIP Parcel Terminal, Lamashegu, Tamale', '0208000014', 9.4075, -0.8533
FROM ghana_regions WHERE name = 'Northern'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Ho Transit Hub', 'Parcel Partner Ltd', 'Ho Bus Terminal, Ho', '0208000015', 6.6003, 0.4705
FROM ghana_regions WHERE name = 'Volta'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Bolgatanga Transit Hub', 'Parcel Partner Ltd', 'STC Terminal, Bolgatanga', '0208000016', 10.7853, -0.8508
FROM ghana_regions WHERE name = 'Upper East'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Wa Transit Hub', 'Parcel Partner Ltd', 'Wa Bus Terminal, Wa', '0208000017', 10.0601, -2.5099
FROM ghana_regions WHERE name = 'Upper West'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Sunyani Transit Hub', 'Parcel Partner Ltd', 'STC Terminal, Sunyani', '0208000018', 7.3354, -2.3291
FROM ghana_regions WHERE name = 'Brong-Ahafo'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Dambai Transit Hub', 'Parcel Partner Ltd', 'Dambai Motor Park', '0208000019', 7.9667, 0.1667
FROM ghana_regions WHERE name = 'Oti'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Techiman Transit Hub', 'Parcel Partner Ltd', 'Techiman Bus Terminal', '0208000020', 7.5893, -1.9348
FROM ghana_regions WHERE name = 'Bono East'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Goaso Transit Hub', 'Parcel Partner Ltd', 'Goaso Motor Park', '0208000021', 6.8022, -2.5197
FROM ghana_regions WHERE name = 'Ahafo'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Damongo Transit Hub', 'Parcel Partner Ltd', 'Damongo Bus Park', '0208000022', 9.0833, -1.8167
FROM ghana_regions WHERE name = 'Savannah'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Nalerigu Transit Hub', 'Parcel Partner Ltd', 'Nalerigu Motor Park', '0208000023', 10.5167, -0.3667
FROM ghana_regions WHERE name = 'North East'
ON CONFLICT DO NOTHING;

INSERT INTO parcel_partner_hubs (region_id, hub_name, partner_name, address, phone, latitude, longitude)
SELECT id, 'Sefwi Wiawso Transit Hub', 'Parcel Partner Ltd', 'Sefwi Wiawso Motor Park', '0208000024', 6.2103, -2.4831
FROM ghana_regions WHERE name = 'Western North'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Transit routes: (route_fee in GHS, transit_days_min/max based on road hours)
-- Source: ~260km Accra–Kumasi road, ~165km Accra–Cape Coast, etc.
-- Fee tiers: <150km ≈ GHS 15–20, 150–300km ≈ GHS 25–35, 300–500km ≈ GHS 40–55,
--            500–700km ≈ GHS 60–75, >700km ≈ GHS 80–100
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO parcel_transit_config (origin_region, dest_region, transit_days_min, transit_days_max, route_fee) VALUES
-- Greater Accra ↔ Ashanti (~260km road, 3–4h)
('Greater Accra', 'Ashanti',       1, 2, 30.00),
('Ashanti',       'Greater Accra', 1, 2, 30.00),

-- Greater Accra ↔ Eastern (~85km road, 1.5h)
('Greater Accra', 'Eastern',       1, 1, 15.00),
('Eastern',       'Greater Accra', 1, 1, 15.00),

-- Greater Accra ↔ Central (~165km road, 2–2.5h)
('Greater Accra', 'Central',       1, 2, 20.00),
('Central',       'Greater Accra', 1, 2, 20.00),

-- Greater Accra ↔ Volta (~170km road, 2.5–3h)
('Greater Accra', 'Volta',         1, 2, 20.00),
('Volta',         'Greater Accra', 1, 2, 20.00),

-- Greater Accra ↔ Western (~250km road, 3–4h)
('Greater Accra', 'Western',       1, 2, 28.00),
('Western',       'Greater Accra', 1, 2, 28.00),

-- Greater Accra ↔ Brong-Ahafo (~350km road, 4–5h)
('Greater Accra', 'Brong-Ahafo',   2, 3, 40.00),
('Brong-Ahafo',   'Greater Accra', 2, 3, 40.00),

-- Greater Accra ↔ Oti (~200km road, 3h)
('Greater Accra', 'Oti',           1, 2, 24.00),
('Oti',           'Greater Accra', 1, 2, 24.00),

-- Greater Accra ↔ Bono East (~400km road, 5h)
('Greater Accra', 'Bono East',     2, 3, 45.00),
('Bono East',     'Greater Accra', 2, 3, 45.00),

-- Greater Accra ↔ Ahafo (~320km road, 4h)
('Greater Accra', 'Ahafo',         2, 3, 38.00),
('Ahafo',         'Greater Accra', 2, 3, 38.00),

-- Greater Accra ↔ Northern (~625km road, 8–10h)
('Greater Accra', 'Northern',      3, 4, 62.00),
('Northern',      'Greater Accra', 3, 4, 62.00),

-- Greater Accra ↔ Savannah (~700km road, 9–11h)
('Greater Accra', 'Savannah',      3, 5, 70.00),
('Savannah',      'Greater Accra', 3, 5, 70.00),

-- Greater Accra ↔ North East (~900km road, 11–13h)
('Greater Accra', 'North East',    4, 6, 90.00),
('North East',    'Greater Accra', 4, 6, 90.00),

-- Greater Accra ↔ Upper East (~830km road, 10–12h)
('Greater Accra', 'Upper East',    4, 5, 82.00),
('Upper East',    'Greater Accra', 4, 5, 82.00),

-- Greater Accra ↔ Upper West (~800km road, 10–12h)
('Greater Accra', 'Upper West',    4, 5, 78.00),
('Upper West',    'Greater Accra', 4, 5, 78.00),

-- Greater Accra ↔ Western North (~400km road, 5h)
('Greater Accra', 'Western North', 2, 3, 45.00),
('Western North', 'Greater Accra', 2, 3, 45.00),

-- Ashanti ↔ Central (~135km road, 2h)
('Ashanti', 'Central',       1, 2, 18.00),
('Central', 'Ashanti',       1, 2, 18.00),

-- Ashanti ↔ Western (~165km road, 2.5h)
('Ashanti', 'Western',       1, 2, 20.00),
('Western', 'Ashanti',       1, 2, 20.00),

-- Ashanti ↔ Eastern (~180km road, 2.5h)
('Ashanti', 'Eastern',       1, 2, 22.00),
('Eastern', 'Ashanti',       1, 2, 22.00),

-- Ashanti ↔ Brong-Ahafo (~120km road, 1.5h)
('Ashanti', 'Brong-Ahafo',   1, 2, 15.00),
('Brong-Ahafo', 'Ashanti',   1, 2, 15.00),

-- Ashanti ↔ Ahafo (~100km road, 1.5h)
('Ashanti', 'Ahafo',         1, 1, 13.00),
('Ahafo',   'Ashanti',       1, 1, 13.00),

-- Ashanti ↔ Bono East (~180km road, 2.5h)
('Ashanti', 'Bono East',     1, 2, 22.00),
('Bono East', 'Ashanti',     1, 2, 22.00),

-- Ashanti ↔ Western North (~130km road, 2h)
('Ashanti', 'Western North', 1, 2, 16.00),
('Western North', 'Ashanti', 1, 2, 16.00),

-- Ashanti ↔ Volta (~230km road, 3.5h)
('Ashanti', 'Volta',         2, 3, 28.00),
('Volta',   'Ashanti',       2, 3, 28.00),

-- Ashanti ↔ Oti (~280km road, 4h)
('Ashanti', 'Oti',           2, 3, 32.00),
('Oti',     'Ashanti',       2, 3, 32.00),

-- Ashanti ↔ Northern (~400km road, 5–6h)
('Ashanti', 'Northern',      2, 3, 45.00),
('Northern', 'Ashanti',      2, 3, 45.00),

-- Ashanti ↔ Savannah (~500km road, 6–7h)
('Ashanti', 'Savannah',      3, 4, 55.00),
('Savannah', 'Ashanti',      3, 4, 55.00),

-- Ashanti ↔ Upper East (~600km road, 7–9h)
('Ashanti', 'Upper East',    3, 4, 65.00),
('Upper East', 'Ashanti',    3, 4, 65.00),

-- Ashanti ↔ Upper West (~580km road, 7–9h)
('Ashanti', 'Upper West',    3, 4, 62.00),
('Upper West', 'Ashanti',    3, 4, 62.00),

-- Ashanti ↔ North East (~700km road, 9–11h)
('Ashanti', 'North East',    4, 5, 75.00),
('North East', 'Ashanti',    4, 5, 75.00),

-- Western ↔ Central (~90km road, 1.5h)
('Western', 'Central',       1, 1, 14.00),
('Central', 'Western',       1, 1, 14.00),

-- Western ↔ Western North (~120km road, 2h)
('Western', 'Western North', 1, 2, 15.00),
('Western North', 'Western', 1, 2, 15.00),

-- Western ↔ Ahafo (~200km road, 3h)
('Western', 'Ahafo',         1, 2, 24.00),
('Ahafo',   'Western',       1, 2, 24.00),

-- Eastern ↔ Volta (~120km road, 2h)
('Eastern', 'Volta',         1, 2, 15.00),
('Volta',   'Eastern',       1, 2, 15.00),

-- Eastern ↔ Oti (~180km road, 2.5h)
('Eastern', 'Oti',           1, 2, 22.00),
('Oti',     'Eastern',       1, 2, 22.00),

-- Northern ↔ Upper East (~220km road, 3h)
('Northern', 'Upper East',   1, 2, 26.00),
('Upper East', 'Northern',   1, 2, 26.00),

-- Northern ↔ Upper West (~250km road, 3.5h)
('Northern', 'Upper West',   2, 3, 30.00),
('Upper West', 'Northern',   2, 3, 30.00),

-- Northern ↔ Savannah (~150km road, 2h)
('Northern', 'Savannah',     1, 2, 18.00),
('Savannah', 'Northern',     1, 2, 18.00),

-- Northern ↔ North East (~200km road, 2.5h)
('Northern', 'North East',   1, 2, 24.00),
('North East', 'Northern',   1, 2, 24.00),

-- Northern ↔ Brong-Ahafo (~300km road, 4h)
('Northern', 'Brong-Ahafo',  2, 3, 35.00),
('Brong-Ahafo', 'Northern',  2, 3, 35.00),

-- Brong-Ahafo ↔ Bono East (~80km road, 1h)
('Brong-Ahafo', 'Bono East', 1, 1, 12.00),
('Bono East', 'Brong-Ahafo', 1, 1, 12.00),

-- Savannah ↔ Upper West (~200km road, 3h)
('Savannah', 'Upper West',   1, 2, 25.00),
('Upper West', 'Savannah',   1, 2, 25.00),

-- Upper East ↔ North East (~150km road, 2h)
('Upper East', 'North East', 1, 2, 18.00),
('North East', 'Upper East', 1, 2, 18.00),

-- Upper East ↔ Upper West (~370km road, 5h)
('Upper East', 'Upper West', 2, 3, 42.00),
('Upper West', 'Upper East', 2, 3, 42.00),

-- Volta ↔ Oti (~100km road, 1.5h)
('Volta', 'Oti',             1, 1, 14.00),
('Oti',   'Volta',           1, 1, 14.00)

ON CONFLICT (origin_region, dest_region) DO UPDATE
  SET route_fee        = EXCLUDED.route_fee,
      transit_days_min = EXCLUDED.transit_days_min,
      transit_days_max = EXCLUDED.transit_days_max;
