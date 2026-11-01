-- The invoice form (owner, 1 November 2026, forms mockup v3, decisions A to G):
-- one public link, /send/<token>, where someone who sends True North invoices
-- proves their email with a 6-digit code, fills in the invoice (their
-- details, the month, the work, reimbursements if they want, their own PDF if
-- they want), sees the preview and sends it. It becomes a normal invoice.
--
--   invoice_settings.form_token          the secret in the public link. "Make a
--                                        new link" replaces it, which stops the
--                                        old address at once.
--   invoice_settings.page_rate,
--   invoice_settings.asset_rate          the deliverable rates for everyone: a
--                                        translated page ($30.00) and a
--                                        translated design asset ($5.00).
--   pay_terms.page_rate, asset_rate      a person's own, when set (Rates & Costs).
--   invoices.source                      'form_fixed' or 'form_deliverables' for
--                                        an invoice that came from the form;
--                                        null for every other invoice. It is a
--                                        'fixed_no_timesheet' invoice to the
--                                        rest of the portal (one step, the
--                                        invoice approver, no timesheet), so
--                                        Approvals, Mark paid, the PDF and the
--                                        Drive copies work as they are.
--   invoices.sender_email                where the sender hears back (they never
--                                        sign in): approved, returned, paid.
--   invoices.own_pdf_path, own_pdf_name  their own invoice PDF, if they attached
--                                        one (the private receipts bucket).
--   invoice_lines.kind 'deliverable'     one line a Monday item, with
--                                        deliverable_kind ('page' or 'asset')
--                                        and deliverable_key (the item's name
--                                        trimmed, spaces collapsed, lower
--                                        case): an item already sent with the
--                                        same kind is refused, for everyone.
--   invoice_form_codes                   the codes sent by email: hashed, 10
--                                        minutes, 5 tries each.
--   invoice_form_submissions             what a sender not in the Directory
--                                        sent: it waits for the default
--                                        approver to link it to a person, and
--                                        only then becomes the numbered invoice.
--
-- One invoice a sender a month from the form (decision C): a unique index on
-- the invoices that came from it, and one on the submissions waiting.
-- The fixed, no timesheet invoices made on day 1 keep their own one a month
-- (invoices_fixed_once), now only for those made by the portal itself.
--
-- Like the rest of North Time, the server decides and writes: the new tables
-- take nothing from the anonymous or signed-in role, and the daily check
-- (db_protections_check) watches them. Safe to run again.

BEGIN;

-- ── The link and the rates ─────────────────────────────────────────────────
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS form_token TEXT;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS page_rate  NUMERIC(10, 2) NOT NULL DEFAULT 30.00;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS asset_rate NUMERIC(10, 2) NOT NULL DEFAULT 5.00;
ALTER TABLE invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_page_rate_check;
ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_page_rate_check CHECK (page_rate > 0 AND page_rate < 10000);
ALTER TABLE invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_asset_rate_check;
ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_asset_rate_check CHECK (asset_rate > 0 AND asset_rate < 10000);
-- A first link, 64 random hex characters, only while there is none.
UPDATE invoice_settings
   SET form_token = replace(gen_random_uuid()::TEXT, '-', '') || replace(gen_random_uuid()::TEXT, '-', '')
 WHERE singleton_id = 1 AND form_token IS NULL;

ALTER TABLE pay_terms ADD COLUMN IF NOT EXISTS page_rate  NUMERIC(10, 2);
ALTER TABLE pay_terms ADD COLUMN IF NOT EXISTS asset_rate NUMERIC(10, 2);
ALTER TABLE pay_terms DROP CONSTRAINT IF EXISTS pay_terms_page_rate_check;
ALTER TABLE pay_terms ADD CONSTRAINT pay_terms_page_rate_check CHECK (page_rate IS NULL OR (page_rate > 0 AND page_rate < 10000));
ALTER TABLE pay_terms DROP CONSTRAINT IF EXISTS pay_terms_asset_rate_check;
ALTER TABLE pay_terms ADD CONSTRAINT pay_terms_asset_rate_check CHECK (asset_rate IS NULL OR (asset_rate > 0 AND asset_rate < 10000));

-- ── Invoices that came from the form ───────────────────────────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source        TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sender_email  TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS own_pdf_path  TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS own_pdf_name  TEXT;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_source_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_source_check
  CHECK (source IS NULL OR (source IN ('form_fixed', 'form_deliverables') AND kind = 'fixed_no_timesheet' AND submission_id IS NULL));

-- The day 1 invoices: one a person and month, the form's ones left out.
DROP INDEX IF EXISTS invoices_fixed_once;
CREATE UNIQUE INDEX invoices_fixed_once ON invoices (person_id, period_start) WHERE kind = 'fixed_no_timesheet' AND source IS NULL;
-- The form's: one a person and month too (decision C).
CREATE UNIQUE INDEX IF NOT EXISTS invoices_form_once ON invoices (person_id, period_start) WHERE source IS NOT NULL;

ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_kind_check;
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_kind_check CHECK (kind IN ('hours', 'fixed', 'reimbursement', 'deliverable'));
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS deliverable_kind TEXT;
ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS deliverable_key  TEXT;
ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_deliverable_check;
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_deliverable_check
  CHECK ((kind = 'deliverable') = (deliverable_kind IS NOT NULL AND deliverable_key IS NOT NULL)
     AND (deliverable_kind IS NULL OR deliverable_kind IN ('page', 'asset')));
CREATE INDEX IF NOT EXISTS invoice_lines_deliverable_idx ON invoice_lines (deliverable_key, deliverable_kind) WHERE deliverable_key IS NOT NULL;

-- ── The codes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_form_codes (
  id          BIGSERIAL PRIMARY KEY,
  -- Lower case, as typed and trimmed.
  email       TEXT NOT NULL,
  -- HMAC of the code (lib/invoice-form/secrets.ts); the code itself is never kept.
  code_hash   TEXT NOT NULL,
  -- A hash of the network address it was asked from, for the hourly cap.
  client_key  TEXT NOT NULL,
  tries       INTEGER NOT NULL DEFAULT 0 CHECK (tries >= 0),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_form_codes_email_idx ON invoice_form_codes (email, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_form_codes_client_idx ON invoice_form_codes (client_key, created_at DESC);

-- ── Senders not in the Directory ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_form_submissions (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  -- What they typed: name, address (people.address's shape) and country.
  sender          JSONB NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('form_fixed', 'form_deliverables')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  -- The work lines and the reimbursements as sent (lib/invoice-form/rules.ts
  -- FormLine and FormReimbursement), receipts already in storage.
  lines           JSONB NOT NULL,
  reimbursements  JSONB NOT NULL DEFAULT '[]'::jsonb,
  total           NUMERIC(12, 2) NOT NULL CHECK (total > 0),
  own_pdf_path    TEXT,
  own_pdf_name    TEXT,
  state           TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'linked')),
  person_id       UUID REFERENCES people(id) ON DELETE SET NULL,
  invoice_id      BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  linked_by       UUID REFERENCES people(id) ON DELETE SET NULL,
  linked_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (state <> 'linked' OR (person_id IS NOT NULL AND invoice_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS invoice_form_submissions_state_idx ON invoice_form_submissions (state, created_at);
-- One waiting a sender and month.
CREATE UNIQUE INDEX IF NOT EXISTS invoice_form_submissions_once ON invoice_form_submissions (lower(email), period_start) WHERE state = 'waiting';

-- ── Reimbursement categories ───────────────────────────────────────────────
-- Migration 116 allowed only the first six; Mileage and Meals while travelling
-- (Tina's review, 29 October 2026, lib/timeclock/reimbursement-rules.ts) were
-- refused by the database, from the portal's own form and from this one.
ALTER TABLE reimbursements DROP CONSTRAINT IF EXISTS reimbursements_category_check;
ALTER TABLE reimbursements ADD CONSTRAINT reimbursements_category_check
  CHECK (category IN ('Internet', 'Software', 'Equipment', 'Travel', 'Mileage', 'Meals while travelling', 'Meals with a client', 'Other'));

-- ── Nothing for the anonymous or signed-in role ────────────────────────────
ALTER TABLE invoice_form_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_form_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON invoice_form_codes, invoice_form_submissions FROM anon, authenticated;
REVOKE ALL ON SEQUENCE invoice_form_codes_id_seq, invoice_form_submissions_id_seq FROM anon, authenticated;

-- ── The daily check (migrations 098, 113, 115, 139) watches them too ───────
CREATE OR REPLACE FUNCTION public.db_protections_check()
RETURNS TEXT[]
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(problem ORDER BY problem), '{}') FROM (
    SELECT 'people.' || c || ' readable by ' || r AS problem
      FROM unnest(ARRAY['internal_rate','monthly_salary','be_rate','address','date_of_birth','email_personal','phone']) c,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.people', c, 'SELECT')
    UNION ALL
    SELECT 'tr_assignments.hourly_rate readable by ' || r
      FROM unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.tr_assignments', 'hourly_rate', 'SELECT')
    UNION ALL
    SELECT t || ' readable by ' || r
      FROM unnest(ARRAY['monday_assignments','monday_assignment_events','monday_board_steps','monday_boards',
                        'monday_users','monday_user_links','monday_team_priority','monday_priority_grants',
                        'monday_snapshot','publishing_targets','publishing_target_periods','publishing_publishers',
                        'sites','pages','page_urls','confirmations','monday_events',
                        'app_settings','settings_change_log',
                        'tc_correction_requests','tc_combinations','tc_person_cadence',
                        'tc_pay_period_anchors','tc_safety_events',
                        'pay_terms','pay_terms_changes','tc_approval_events','invoices','invoice_lines',
                        'invoice_settings','reimbursement_documents','reimbursements','extra_hours_requests',
                        'integration_jobs','people_type_changes','agenda_events',
                        'agenda_accounts','agenda_person_settings','agenda_busy','agenda_event_guests',
                        'agenda_booking_links','agenda_bookings','agenda_account_tokens',
                        'reimbursement_reports','invoice_form_codes','invoice_form_submissions']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'SELECT')
    UNION ALL
    SELECT t || ' writable by ' || r
      FROM unnest(ARRAY['tc_entries','tc_submissions','tc_absence_requests','tc_entry_audit',
                        'tc_periods','tc_settings']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'INSERT')
        OR has_table_privilege(r, 'public.' || t, 'UPDATE')
        OR has_table_privilege(r, 'public.' || t, 'DELETE')
    UNION ALL
    SELECT f || ' callable by ' || r
      FROM unnest(ARRAY['merge_people(uuid,uuid)','merge_monday_links(uuid,uuid)','portal_can_sign_in(text)',
                        'portal_end_sessions(uuid)','portal_two_step_status(uuid)',
                        'monday_swap_board_assignments(bigint,uuid)','access_commit(jsonb,jsonb,jsonb)',
                        'set_person_teams(uuid,jsonb)',
                        'report_counted_events(bigint[])','report_span_events(bigint[],timestamptz)',
                        'report_open_since(bigint[])','report_flow_events(bigint[],timestamptz)',
                        'report_hours(uuid[],date)','report_jobcode_hours(integer[],date)',
                        'report_person_hours(uuid,date)',
                        'monday_write_board(bigint,uuid,jsonb)','monday_assignment_counts()',
                        'publishing_set_target(text,text,text,integer,text,date)',
                        'publishing_remove_target(uuid,text,date)',
                        'prune_monday_events()',
                        'my_work_list(bigint[],bigint[],bigint[],boolean,timestamptz,integer)',
                        'tc_job_field_defaults(date,text[])','next_document_number(text)',
                        'agenda_booking_hold(uuid,timestamptz,timestamptz,integer,text,text,text[],text,text,text,text,timestamptz)',
                        'agenda_booking_confirm(text,integer)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
