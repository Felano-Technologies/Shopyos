-- 035: per-hub handoff code for first-mile drop-off verification
--
-- A first-mile driver hands the parcel to hub staff (no customer PIN applies).
-- Each hub gets a short code that staff read to the driver; the driver enters
-- it to confirm the drop-off, mirroring the customer PIN on the buyer end.

ALTER TABLE parcel_partner_hubs ADD COLUMN IF NOT EXISTS handoff_code VARCHAR(8);

-- One-time backfill: give every existing hub a 4-digit code.
UPDATE parcel_partner_hubs
SET handoff_code = LPAD((FLOOR(RANDOM() * 10000))::int::text, 4, '0')
WHERE handoff_code IS NULL;
