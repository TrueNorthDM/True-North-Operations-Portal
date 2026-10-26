-- Invoice and reimbursement document numbers keep counting across years
-- (owner, 2026-10-26): only the year changes, INV-2026-059 then INV-2027-060.
-- The count has at least three digits (INV-2026-001) and grows past 999
-- without being cut (lpad alone would cut 1000 to "100").
--
-- Replaces migration 118's version, which restarted at 0001 every January.
-- number_year and rmb_number_year stay as a record of the last year a number
-- was given; nothing reads them to restart any more.

BEGIN;

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
  END IF;
  RAISE EXCEPTION 'unknown document kind %', p_kind;
END $$;
REVOKE ALL ON FUNCTION public.next_document_number(TEXT) FROM PUBLIC, anon, authenticated;

COMMIT;
