-- Migration 050: Fill in the remaining Ghana region-pair transit routes.
--
-- 017_parcel_transit_routes.sql only covered pairs involving Greater Accra
-- and Ashanti (29 of 120 possible unordered region pairs) — any order between
-- two OTHER regions (e.g. Western <-> Upper East) had no seeded route, so
-- getTransitConfig() returned null and the transit fee silently fell back to
-- the flat 'parcel_partner_base_fee' (GHS 25) regardless of actual distance —
-- badly underpricing genuinely long routes and overpricing short ones.
--
-- These 76 remaining pairs are estimated from straight-line distance between
-- each region's hub coordinates (already seeded in 017), scaled by a ~1.35x
-- road-distance factor calibrated against 017's own real-road-distance
-- anchors (e.g. Accra-Kumasi: 200km straight-line vs actual 260km road ≈
-- 1.30x; Accra-Bolgatanga: 581km vs 830km ≈ 1.43x), then mapped through the
-- same fee tiers 017 already documented:
--   <150km ≈ GHS 15–20, 150–300km ≈ GHS 25–35, 300–500km ≈ GHS 40–55,
--   500–700km ≈ GHS 60–75, >700km ≈ GHS 80–100
--
-- These are starting estimates, not final pricing — admins can edit any of
-- these per-route fees from the admin Hubs & Transit screen at any time.
INSERT INTO parcel_transit_config (origin_region, dest_region, transit_days_min, transit_days_max, route_fee) VALUES
-- Western <-> Eastern (~287km road, est.)
('Western', 'Eastern', 1, 2, 34.00),
('Eastern', 'Western', 1, 2, 34.00),

-- Western <-> Northern (~690km road, est.)
('Western', 'Northern', 3, 4, 74.00),
('Northern', 'Western', 3, 4, 74.00),

-- Western <-> Volta (~419km road, est.)
('Western', 'Volta', 2, 3, 49.00),
('Volta', 'Western', 2, 3, 49.00),

-- Western <-> Upper East (~894km road, est.)
('Western', 'Upper East', 4, 6, 93.00),
('Upper East', 'Western', 4, 6, 93.00),

-- Western <-> Upper West (~783km road, est.)
('Western', 'Upper West', 4, 6, 86.00),
('Upper West', 'Western', 4, 6, 86.00),

-- Western <-> Brong-Ahafo (~376km road, est.)
('Western', 'Brong-Ahafo', 2, 3, 46.00),
('Brong-Ahafo', 'Western', 2, 3, 46.00),

-- Western <-> Oti (~543km road, est.)
('Western', 'Oti', 3, 4, 63.00),
('Oti', 'Western', 3, 4, 63.00),

-- Western <-> Bono East (~405km road, est.)
('Western', 'Bono East', 2, 3, 48.00),
('Bono East', 'Western', 2, 3, 48.00),

-- Western <-> Savannah (~629km road, est.)
('Western', 'Savannah', 3, 4, 70.00),
('Savannah', 'Western', 3, 4, 70.00),

-- Western <-> North East (~869km road, est.)
('Western', 'North East', 4, 6, 91.00),
('North East', 'Western', 4, 6, 91.00),

-- Eastern <-> Central (~213km road, est.)
('Eastern', 'Central', 1, 2, 29.00),
('Central', 'Eastern', 1, 2, 29.00),

-- Eastern <-> Northern (~505km road, est.)
('Eastern', 'Northern', 3, 4, 60.00),
('Northern', 'Eastern', 3, 4, 60.00),

-- Eastern <-> Upper East (~710km road, est.)
('Eastern', 'Upper East', 4, 6, 81.00),
('Upper East', 'Eastern', 4, 6, 81.00),

-- Eastern <-> Upper West (~683km road, est.)
('Eastern', 'Upper West', 3, 4, 74.00),
('Upper West', 'Eastern', 3, 4, 74.00),

-- Eastern <-> Brong-Ahafo (~360km road, est.)
('Eastern', 'Brong-Ahafo', 2, 3, 45.00),
('Brong-Ahafo', 'Eastern', 2, 3, 45.00),

-- Eastern <-> Bono East (~336km road, est.)
('Eastern', 'Bono East', 2, 3, 43.00),
('Bono East', 'Eastern', 2, 3, 43.00),

-- Eastern <-> Ahafo (~353km road, est.)
('Eastern', 'Ahafo', 2, 3, 44.00),
('Ahafo', 'Eastern', 2, 3, 44.00),

-- Eastern <-> Savannah (~505km road, est.)
('Eastern', 'Savannah', 3, 4, 60.00),
('Savannah', 'Eastern', 3, 4, 60.00),

-- Eastern <-> North East (~664km road, est.)
('Eastern', 'North East', 3, 4, 72.00),
('North East', 'Eastern', 3, 4, 72.00),

-- Eastern <-> Western North (~332km road, est.)
('Eastern', 'Western North', 2, 3, 42.00),
('Western North', 'Eastern', 2, 3, 42.00),

-- Central <-> Northern (~649km road, est.)
('Central', 'Northern', 3, 4, 71.00),
('Northern', 'Central', 3, 4, 71.00),

-- Central <-> Volta (~345km road, est.)
('Central', 'Volta', 2, 3, 43.00),
('Volta', 'Central', 2, 3, 43.00),

-- Central <-> Upper East (~855km road, est.)
('Central', 'Upper East', 4, 6, 90.00),
('Upper East', 'Central', 4, 6, 90.00),

-- Central <-> Upper West (~766km road, est.)
('Central', 'Upper West', 4, 6, 84.00),
('Upper West', 'Central', 4, 6, 84.00),

-- Central <-> Brong-Ahafo (~370km road, est.)
('Central', 'Brong-Ahafo', 2, 3, 45.00),
('Brong-Ahafo', 'Central', 2, 3, 45.00),

-- Central <-> Oti (~481km road, est.)
('Central', 'Oti', 2, 3, 54.00),
('Oti', 'Central', 2, 3, 54.00),

-- Central <-> Bono East (~386km road, est.)
('Central', 'Bono East', 2, 3, 46.00),
('Bono East', 'Central', 2, 3, 46.00),

-- Central <-> Ahafo (~315km road, est.)
('Central', 'Ahafo', 2, 3, 41.00),
('Ahafo', 'Central', 2, 3, 41.00),

-- Central <-> Savannah (~603km road, est.)
('Central', 'Savannah', 3, 4, 68.00),
('Savannah', 'Central', 3, 4, 68.00),

-- Central <-> North East (~824km road, est.)
('Central', 'North East', 4, 6, 88.00),
('North East', 'Central', 4, 6, 88.00),

-- Central <-> Western North (~245km road, est.)
('Central', 'Western North', 1, 2, 31.00),
('Western North', 'Central', 1, 2, 31.00),

-- Northern <-> Volta (~465km road, est.)
('Northern', 'Volta', 2, 3, 52.00),
('Volta', 'Northern', 2, 3, 52.00),

-- Northern <-> Oti (~264km road, est.)
('Northern', 'Oti', 1, 2, 33.00),
('Oti', 'Northern', 1, 2, 33.00),

-- Northern <-> Bono East (~317km road, est.)
('Northern', 'Bono East', 2, 3, 41.00),
('Bono East', 'Northern', 2, 3, 41.00),

-- Northern <-> Ahafo (~463km road, est.)
('Northern', 'Ahafo', 2, 3, 52.00),
('Ahafo', 'Northern', 2, 3, 52.00),

-- Northern <-> Western North (~538km road, est.)
('Northern', 'Western North', 3, 4, 63.00),
('Western North', 'Northern', 3, 4, 63.00),

-- Volta <-> Upper East (~658km road, est.)
('Volta', 'Upper East', 3, 4, 72.00),
('Upper East', 'Volta', 3, 4, 72.00),

-- Volta <-> Upper West (~682km road, est.)
('Volta', 'Upper West', 3, 4, 74.00),
('Upper West', 'Volta', 3, 4, 74.00),

-- Volta <-> Brong-Ahafo (~431km road, est.)
('Volta', 'Brong-Ahafo', 2, 3, 50.00),
('Brong-Ahafo', 'Volta', 2, 3, 50.00),

-- Volta <-> Bono East (~388km road, est.)
('Volta', 'Bono East', 2, 3, 47.00),
('Bono East', 'Volta', 2, 3, 47.00),

-- Volta <-> Ahafo (~447km road, est.)
('Volta', 'Ahafo', 2, 3, 51.00),
('Ahafo', 'Volta', 2, 3, 51.00),

-- Volta <-> Savannah (~505km road, est.)
('Volta', 'Savannah', 3, 4, 60.00),
('Savannah', 'Volta', 3, 4, 60.00),

-- Volta <-> North East (~601km road, est.)
('Volta', 'North East', 3, 4, 68.00),
('North East', 'Volta', 3, 4, 68.00),

-- Volta <-> Western North (~444km road, est.)
('Volta', 'Western North', 2, 3, 51.00),
('Western North', 'Volta', 2, 3, 51.00),

-- Upper East <-> Brong-Ahafo (~562km road, est.)
('Upper East', 'Brong-Ahafo', 3, 4, 65.00),
('Brong-Ahafo', 'Upper East', 3, 4, 65.00),

-- Upper East <-> Oti (~449km road, est.)
('Upper East', 'Oti', 2, 3, 51.00),
('Oti', 'Upper East', 2, 3, 51.00),

-- Upper East <-> Bono East (~506km road, est.)
('Upper East', 'Bono East', 3, 4, 60.00),
('Bono East', 'Upper East', 3, 4, 60.00),

-- Upper East <-> Ahafo (~647km road, est.)
('Upper East', 'Ahafo', 3, 4, 71.00),
('Ahafo', 'Upper East', 3, 4, 71.00),

-- Upper East <-> Savannah (~293km road, est.)
('Upper East', 'Savannah', 1, 2, 35.00),
('Savannah', 'Upper East', 1, 2, 35.00),

-- Upper East <-> Western North (~728km road, est.)
('Upper East', 'Western North', 4, 6, 82.00),
('Western North', 'Upper East', 4, 6, 82.00),

-- Upper West <-> Brong-Ahafo (~410km road, est.)
('Upper West', 'Brong-Ahafo', 2, 3, 48.00),
('Brong-Ahafo', 'Upper West', 2, 3, 48.00),

-- Upper West <-> Oti (~506km road, est.)
('Upper West', 'Oti', 3, 4, 60.00),
('Oti', 'Upper West', 3, 4, 60.00),

-- Upper West <-> Bono East (~381km road, est.)
('Upper West', 'Bono East', 2, 3, 46.00),
('Bono East', 'Upper West', 2, 3, 46.00),

-- Upper West <-> Ahafo (~489km road, est.)
('Upper West', 'Ahafo', 2, 3, 54.00),
('Ahafo', 'Upper West', 2, 3, 54.00),

-- Upper West <-> North East (~324km road, est.)
('Upper West', 'North East', 2, 3, 42.00),
('North East', 'Upper West', 2, 3, 42.00),

-- Upper West <-> Western North (~578km road, est.)
('Upper West', 'Western North', 3, 4, 66.00),
('Western North', 'Upper West', 3, 4, 66.00),

-- Brong-Ahafo <-> Oti (~383km road, est.)
('Brong-Ahafo', 'Oti', 2, 3, 46.00),
('Oti', 'Brong-Ahafo', 2, 3, 46.00),

-- Brong-Ahafo <-> Ahafo (~85km road, est.)
('Brong-Ahafo', 'Ahafo', 1, 1, 18.00),
('Ahafo', 'Brong-Ahafo', 1, 1, 18.00),

-- Brong-Ahafo <-> Savannah (~273km road, est.)
('Brong-Ahafo', 'Savannah', 1, 2, 33.00),
('Savannah', 'Brong-Ahafo', 1, 2, 33.00),

-- Brong-Ahafo <-> North East (~559km road, est.)
('Brong-Ahafo', 'North East', 3, 4, 64.00),
('North East', 'Brong-Ahafo', 3, 4, 64.00),

-- Brong-Ahafo <-> Western North (~170km road, est.)
('Brong-Ahafo', 'Western North', 1, 2, 26.00),
('Western North', 'Brong-Ahafo', 1, 2, 26.00),

-- Oti <-> Bono East (~318km road, est.)
('Oti', 'Bono East', 2, 3, 41.00),
('Bono East', 'Oti', 2, 3, 41.00),

-- Oti <-> Ahafo (~436km road, est.)
('Oti', 'Ahafo', 2, 3, 50.00),
('Ahafo', 'Oti', 2, 3, 50.00),

-- Oti <-> Savannah (~339km road, est.)
('Oti', 'Savannah', 2, 3, 43.00),
('Savannah', 'Oti', 2, 3, 43.00),

-- Oti <-> North East (~391km road, est.)
('Oti', 'North East', 2, 3, 47.00),
('North East', 'Oti', 2, 3, 47.00),

-- Oti <-> Western North (~475km road, est.)
('Oti', 'Western North', 2, 3, 53.00),
('Western North', 'Oti', 2, 3, 53.00),

-- Bono East <-> Ahafo (~147km road, est.)
('Bono East', 'Ahafo', 1, 1, 20.00),
('Ahafo', 'Bono East', 1, 1, 20.00),

-- Bono East <-> Savannah (~225km road, est.)
('Bono East', 'Savannah', 1, 2, 30.00),
('Savannah', 'Bono East', 1, 2, 30.00),

-- Bono East <-> North East (~497km road, est.)
('Bono East', 'North East', 2, 3, 55.00),
('North East', 'Bono East', 2, 3, 55.00),

-- Bono East <-> Western North (~223km road, est.)
('Bono East', 'Western North', 1, 2, 30.00),
('Western North', 'Bono East', 1, 2, 30.00),

-- Ahafo <-> Savannah (~358km road, est.)
('Ahafo', 'Savannah', 2, 3, 44.00),
('Savannah', 'Ahafo', 2, 3, 44.00),

-- Ahafo <-> North East (~643km road, est.)
('Ahafo', 'North East', 3, 4, 71.00),
('North East', 'Ahafo', 3, 4, 71.00),

-- Ahafo <-> Western North (~89km road, est.)
('Ahafo', 'Western North', 1, 1, 18.00),
('Western North', 'Ahafo', 1, 1, 18.00),

-- Savannah <-> North East (~304km road, est.)
('Savannah', 'North East', 2, 3, 40.00),
('North East', 'Savannah', 2, 3, 40.00),

-- Savannah <-> Western North (~443km road, est.)
('Savannah', 'Western North', 2, 3, 51.00),
('Western North', 'Savannah', 2, 3, 51.00),

-- North East <-> Western North (~719km road, est.)
('North East', 'Western North', 4, 6, 81.00),
('Western North', 'North East', 4, 6, 81.00)

ON CONFLICT (origin_region, dest_region) DO UPDATE
  SET route_fee        = EXCLUDED.route_fee,
      transit_days_min = EXCLUDED.transit_days_min,
      transit_days_max = EXCLUDED.transit_days_max;
