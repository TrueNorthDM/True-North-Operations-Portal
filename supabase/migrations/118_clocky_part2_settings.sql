-- Clocky part 2, Company settings (Company Settings.dc.html 13A, 13B, 13C).
--
--   13B  Invoice and reimbursement numbers restart at 0001 every January (New
--        York year), as the Invoices section says; the year each counter is in
--        is kept beside it.
--   13A  Who connected Rippling and Google Calendar, and when.
--   13C  The timesheet reminders, each on or off.
--
-- app_settings and invoice_settings stay closed to the anonymous and signed-in
-- roles (migrations 098, 115); the server reads and writes them.

BEGIN;

ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS number_year     INTEGER;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS rmb_number_year INTEGER;

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
    n := CASE WHEN s.number_year IS NOT NULL AND s.number_year <> y THEN 1 ELSE s.next_number END;
    UPDATE invoice_settings SET next_number = n + 1, number_year = y WHERE singleton_id = 1;
    RETURN s.prefix || '-' || y || '-' || lpad(n::TEXT, 4, '0');
  ELSIF p_kind = 'reimbursement' THEN
    n := CASE WHEN s.rmb_number_year IS NOT NULL AND s.rmb_number_year <> y THEN 1 ELSE s.rmb_next_number END;
    UPDATE invoice_settings SET rmb_next_number = n + 1, rmb_number_year = y WHERE singleton_id = 1;
    RETURN s.rmb_prefix || '-' || y || '-' || lpad(n::TEXT, 4, '0');
  END IF;
  RAISE EXCEPTION 'unknown document kind %', p_kind;
END $$;
REVOKE ALL ON FUNCTION public.next_document_number(TEXT) FROM PUBLIC, anon, authenticated;

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS rippling_connected_by UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS rippling_connected_at TIMESTAMPTZ;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_connected_by   UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_connected_at   TIMESTAMPTZ;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS clocky_reminders      JSONB NOT NULL
  DEFAULT '{"contractor_due": true, "pay_period_ends": true, "late": true, "allowance": true, "birthday": true}'::jsonb;

COMMIT;
