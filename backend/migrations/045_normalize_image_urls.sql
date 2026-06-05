-- Normalize all image/file URLs to relative paths.
--
-- Problem: old records were saved with full provider URLs
-- (e.g. https://shopyos-storage-ojxfu.sevalla.storage/shopyos/...).
-- The current code correctly saves relative paths only, but migrated
-- data still contains provider-specific full URLs.
--
-- Fix: strip any https?://domain/ prefix from every image field.
-- toPublicUrl() in storage.js re-adds STORAGE_PUBLIC_URL at read time,
-- so changing the storage endpoint in future only requires an env var update.
--
-- Safe to re-run: WHERE clauses only match rows starting with 'http'.

-- stores
UPDATE stores
SET logo_url = REGEXP_REPLACE(logo_url, '^https?://[^/]+/', '')
WHERE logo_url LIKE 'http%';

UPDATE stores
SET banner_url = REGEXP_REPLACE(banner_url, '^https?://[^/]+/', '')
WHERE banner_url LIKE 'http%';

UPDATE stores
SET business_cert_url = REGEXP_REPLACE(business_cert_url, '^https?://[^/]+/', '')
WHERE business_cert_url LIKE 'http%';

UPDATE stores
SET business_license_url = REGEXP_REPLACE(business_license_url, '^https?://[^/]+/', '')
WHERE business_license_url LIKE 'http%';

UPDATE stores
SET proof_of_bank_url = REGEXP_REPLACE(proof_of_bank_url, '^https?://[^/]+/', '')
WHERE proof_of_bank_url LIKE 'http%';

-- user_profiles
UPDATE user_profiles
SET avatar_url = REGEXP_REPLACE(avatar_url, '^https?://[^/]+/', '')
WHERE avatar_url LIKE 'http%';

-- driver_profiles
UPDATE driver_profiles
SET
  license_image_url = CASE WHEN license_image_url LIKE 'http%' THEN REGEXP_REPLACE(license_image_url, '^https?://[^/]+/', '') ELSE license_image_url END,
  national_id_url   = CASE WHEN national_id_url   LIKE 'http%' THEN REGEXP_REPLACE(national_id_url,   '^https?://[^/]+/', '') ELSE national_id_url   END,
  insurance_doc_url = CASE WHEN insurance_doc_url LIKE 'http%' THEN REGEXP_REPLACE(insurance_doc_url, '^https?://[^/]+/', '') ELSE insurance_doc_url END,
  vehicle_reg_url   = CASE WHEN vehicle_reg_url   LIKE 'http%' THEN REGEXP_REPLACE(vehicle_reg_url,   '^https?://[^/]+/', '') ELSE vehicle_reg_url   END,
  roadworthy_url    = CASE WHEN roadworthy_url    LIKE 'http%' THEN REGEXP_REPLACE(roadworthy_url,    '^https?://[^/]+/', '') ELSE roadworthy_url    END
WHERE
  license_image_url LIKE 'http%' OR
  national_id_url   LIKE 'http%' OR
  insurance_doc_url LIKE 'http%' OR
  vehicle_reg_url   LIKE 'http%' OR
  roadworthy_url    LIKE 'http%';

-- product_images
UPDATE product_images
SET image_url = REGEXP_REPLACE(image_url, '^https?://[^/]+/', '')
WHERE image_url LIKE 'http%';

-- banner_campaigns
UPDATE banner_campaigns
SET banner_url = REGEXP_REPLACE(banner_url, '^https?://[^/]+/', '')
WHERE banner_url LIKE 'http%';

-- messages (file attachments)
UPDATE messages
SET attachment_url = REGEXP_REPLACE(attachment_url, '^https?://[^/]+/', '')
WHERE attachment_url IS NOT NULL AND attachment_url LIKE 'http%';
