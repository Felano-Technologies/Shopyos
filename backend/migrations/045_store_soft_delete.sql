-- Adds soft-delete support to stores, matching the existing users.deleted_at pattern.
-- Also fixes a pre-existing bug: businessController.deleteBusiness already calls
-- repositories.stores.softDelete() (BaseRepository.softDelete -> UPDATE ... deleted_at),
-- which would have failed with "column deleted_at does not exist" since this column
-- never existed on stores.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stores_deleted_at ON stores(deleted_at) WHERE deleted_at IS NULL;
