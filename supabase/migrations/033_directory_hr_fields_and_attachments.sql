-- 033_directory_hr_fields_and_attachments.sql
--
-- Makes the Directory the HR source of truth. Pulls in the last fields that only
-- lived on the "True North Team" Monday board (2547376221) plus its "History"
-- file attachments, so the /admin/team mirror page can be retired.
--
-- Adds to people:
--   last_name            — the board keeps first (item name) + last name separately
--   team_meeting         — "Team Meeting" checkbox
--   manager_name_text    — free-text "Please type the name of your manager below"
--                          (kept alongside manager_id FK + reports_to_manager)
--   whatsapp_same_number — "Do you use the same phone number on WhatsApp?" ('yes'|'no')
--   monday_item_id       — board item id, so the one-off importer is idempotent
--
-- Adds person_attachments (the board's "History" files) + a private Storage
-- bucket to hold the binaries. Admin-only writes, authenticated read — same
-- shape as the people directory (014).
--
-- Depends on 007 (is_admin), 001 (update_updated_at), 014 (people).

BEGIN;

-- ── New people columns ──────────────────────────────────────────────────────
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS last_name            text,
  ADD COLUMN IF NOT EXISTS team_meeting         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_name_text    text,      -- free-text manager (board question)
  ADD COLUMN IF NOT EXISTS whatsapp_same_number text,      -- 'yes' | 'no'
  ADD COLUMN IF NOT EXISTS monday_item_id       text;      -- board item id (import idempotency)

-- One directory person per board item; many people have no board id (NULL).
CREATE UNIQUE INDEX IF NOT EXISTS people_monday_item_id_unique
  ON people (monday_item_id)
  WHERE monday_item_id IS NOT NULL;

-- ── person_attachments — the board's "History" files ────────────────────────
CREATE TABLE IF NOT EXISTS person_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  storage_path    text NOT NULL,                 -- object key inside the person-files bucket
  mime            text,
  size_bytes      bigint,
  monday_asset_id text,                          -- source Monday asset (import idempotency), NULL for portal uploads
  uploaded_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS person_attachments_person_idx ON person_attachments(person_id);
-- Don't re-download the same Monday asset on a re-run.
CREATE UNIQUE INDEX IF NOT EXISTS person_attachments_asset_unique
  ON person_attachments (monday_asset_id)
  WHERE monday_asset_id IS NOT NULL;

ALTER TABLE person_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_attachments_read ON person_attachments;
CREATE POLICY person_attachments_read ON person_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS person_attachments_admin_write ON person_attachments;
CREATE POLICY person_attachments_admin_write ON person_attachments FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ── Private Storage bucket for the attachment binaries ──────────────────────
-- Files are HR documents — never public. Admins read/write via signed URLs from
-- their own session; the importer uses the service role (bypasses these).
INSERT INTO storage.buckets (id, name, public)
  VALUES ('person-files', 'person-files', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS person_files_admin_all ON storage.objects;
CREATE POLICY person_files_admin_all ON storage.objects FOR ALL TO authenticated
  USING      (bucket_id = 'person-files' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'person-files' AND public.is_admin(auth.uid()));

COMMIT;
