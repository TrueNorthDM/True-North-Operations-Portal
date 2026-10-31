-- Google Drive through office@ (owner, 30 October 2026, "Google Integration:
-- what is left"): a Super Admin picks, with Google's Picker, the Drive folder
-- the portal writes into (Tina's receipts and invoices folder, shared with
-- office@). The portal only ever sees that folder and the files it makes in it
-- (the drive.file permission). app_settings stays server only (migration 098).

BEGIN;

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS drive_folder_id    TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS drive_folder_name  TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS drive_folder_by    UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS drive_folder_at    TIMESTAMPTZ;

COMMIT;
