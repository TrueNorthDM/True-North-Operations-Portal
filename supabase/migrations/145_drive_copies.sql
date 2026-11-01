-- Google Drive copies (owner, 31 October 2026, "Docs from the Portal"):
-- every approved invoice, every reimbursement receipt and every reimbursement
-- document gets a copy in the Drive folder a Super Admin picked (migration
-- 143), written by the portal through office@. The portal stays the record;
-- Drive is Finance's copy.
--
--   receipt numbers   a receipt gets its own number like invoices and RMB
--                     documents: RCT, the New York year, a count that never
--                     restarts (RCT-2026-005). Given when the request is sent
--                     (next_document_number('receipt')); the receipts already
--                     sent are numbered here by when they were asked for, and
--                     the count goes on after them.
--   drive_copy_from   only what is approved or made on or after this day is
--                     copied (1 November 2026); older items stay where they are.
--   drive_copies      one row a copied item: what is in Drive (version_key,
--                     'approved:...', 'paid:...' or 'made:...'), the file, the
--                     tries and the last error. The scheduled route
--                     /api/cron/drive-copies writes it; nothing else does.
--
-- Like the rest of Clocky, the server decides and writes: these take nothing
-- from the anonymous or signed-in role. Safe to run again.

BEGIN;

-- ── Receipt numbering ──────────────────────────────────────────────────────
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS rct_prefix       TEXT    NOT NULL DEFAULT 'RCT';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS rct_next_number  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS rct_number_year  INTEGER;
ALTER TABLE invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_rct_next_number_check;
ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_rct_next_number_check CHECK (rct_next_number > 0);

ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS receipt_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS reimbursements_receipt_number_key ON reimbursements (receipt_number) WHERE receipt_number IS NOT NULL;

-- Takes the next number under a row lock: two documents never share one.
-- Migration 124's function with the receipt added; the count never restarts.
CREATE OR REPLACE FUNCTION public.next_document_number(p_kind TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s invoice_settings%ROWTYPE;
  n INTEGER;
  y INTEGER := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY')::INTEGER;
BEGIN
  SELECT * INTO s FROM invoice_settings WHERE singleton_id = 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice settings missing'; END IF;
  IF p_kind = 'invoice' THEN
    n := s.next_number;
    UPDATE invoice_settings SET next_number = n + 1, number_year = y WHERE singleton_id = 1;
    RETURN s.prefix || '-' || y || '-' || CASE WHEN n >= 1000 THEN n::TEXT ELSE lpad(n::TEXT, 3, '0') END;
  ELSIF p_kind = 'reimbursement' THEN
    n := s.rmb_next_number;
    UPDATE invoice_settings SET rmb_next_number = n + 1, rmb_number_year = y WHERE singleton_id = 1;
    RETURN s.rmb_prefix || '-' || y || '-' || CASE WHEN n >= 1000 THEN n::TEXT ELSE lpad(n::TEXT, 3, '0') END;
  ELSIF p_kind = 'receipt' THEN
    n := s.rct_next_number;
    UPDATE invoice_settings SET rct_next_number = n + 1, rct_number_year = y WHERE singleton_id = 1;
    RETURN s.rct_prefix || '-' || y || '-' || CASE WHEN n >= 1000 THEN n::TEXT ELSE lpad(n::TEXT, 3, '0') END;
  END IF;
  RAISE EXCEPTION 'unknown document kind %', p_kind;
END $$;
REVOKE ALL ON FUNCTION public.next_document_number(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT) TO service_role;

-- The receipts already sent, numbered in the order they were asked for, each
-- with the New York year it was asked in; the count goes on after them. Only
-- receipts with no number yet, so a second run numbers nothing twice.
DO $$
DECLARE
  s invoice_settings%ROWTYPE;
  n INTEGER;
  r RECORD;
BEGIN
  SELECT * INTO s FROM invoice_settings WHERE singleton_id = 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  n := s.rct_next_number;
  FOR r IN SELECT id, asked_at FROM reimbursements WHERE receipt_path IS NOT NULL AND receipt_number IS NULL ORDER BY asked_at, id LOOP
    UPDATE reimbursements
       SET receipt_number = s.rct_prefix || '-' || to_char(r.asked_at AT TIME ZONE 'America/New_York', 'YYYY') || '-' || CASE WHEN n >= 1000 THEN n::TEXT ELSE lpad(n::TEXT, 3, '0') END
     WHERE id = r.id;
    n := n + 1;
  END LOOP;
  IF n <> s.rct_next_number THEN
    UPDATE invoice_settings SET rct_next_number = n, rct_number_year = to_char(now() AT TIME ZONE 'America/New_York', 'YYYY')::INTEGER WHERE singleton_id = 1;
  END IF;
END $$;

-- ── From when ──────────────────────────────────────────────────────────────
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS drive_copy_from DATE NOT NULL DEFAULT '2026-11-01';

-- ── The copies ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drive_copies (
  id             BIGSERIAL PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('invoice', 'receipt', 'rmb')),
  -- invoices.id, reimbursements.id (its receipt) or reimbursement_documents.id.
  ref_id         BIGINT NOT NULL,
  -- What is in Drive now (null until the first copy), and what the last try wrote.
  version_key    TEXT,
  pending_key    TEXT,
  state          TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'done', 'failed')),
  drive_file_id  TEXT,
  web_link       TEXT,
  file_name      TEXT,
  -- "Docs from the Portal / Invoices", as the card and the side panel say it.
  folder_path    TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  -- When a waiting copy may be tried again (a try that failed waits a little longer each time).
  next_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Taken by a run while it writes the file, so two runs never write the same one.
  claimed_at     TIMESTAMPTZ,
  -- Each version written: [{"key": "approved:...", "at": "..."}], oldest first.
  history        JSONB NOT NULL DEFAULT '[]'::jsonb,
  copied_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id)
);
CREATE INDEX IF NOT EXISTS drive_copies_state_idx ON drive_copies (state) WHERE state <> 'done';

ALTER TABLE drive_copies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON drive_copies FROM anon, authenticated;
REVOKE ALL ON SEQUENCE drive_copies_id_seq FROM anon, authenticated;

COMMIT;
