-- 115_clocky_part2_pay_invoices.sql
--
-- Clocky part 2, step 1 (docs/time-clock/06-clocky-part2-design.md, handoff
-- Design/design_handoff_clocky 2/README_PART2.md): how each person is paid,
-- the approval steps of a timesheet, and the invoices a contractor's timesheet
-- makes.
--
--   pay_terms             Pays as (hourly, fixed monthly, fixed with no
--                         timesheet) and the hours allowance. The money stays
--                         where Rates & Costs keeps it: the hourly rate is
--                         people.internal_rate ("Rate / cost"), the fixed
--                         amount people.monthly_salary ("Month / salary").
--   tc_submissions        two more states: hours_approved (step 1 of 2 done)
--                         and recorded (the Deputy Director's own, no approval).
--   tc_approval_events    every decision on a timesheet: who, when, why.
--   invoices, invoice_lines
--                         made when a contractor submits (or on day 1 for the
--                         fixed, no timesheet ones); lines are frozen.
--   invoice_settings      one row: numbering, True North's billing details,
--                         who approves invoices, the Deputy Director, Finance.
--
-- Like the rest of Clocky (migration 113), the server decides and writes:
-- these tables take nothing from the anonymous or signed-in role, and the
-- daily check watches them. Money is read only by the server, after the
-- access check in app code.
--
-- Safe to run again.

BEGIN;

-- ── How each person is paid ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pay_terms (
  person_id        UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  -- Contractors only; employees are paid through Rippling (null here).
  pays_as          TEXT CHECK (pays_as IN ('hourly', 'fixed_monthly', 'fixed_no_timesheet')),
  allowance_hours  NUMERIC(6, 2) CHECK (allowance_hours IS NULL OR allowance_hours > 0),
  allowance_period TEXT CHECK (allowance_period IN ('week', 'month')),
  updated_by       UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((allowance_hours IS NULL) = (allowance_period IS NULL))
);
-- A first draft of this migration kept a fixed amount here; it is monthly_salary.
ALTER TABLE pay_terms DROP COLUMN IF EXISTS fixed_amount;

-- Every change, with the reason Rates & Costs and the person page ask for.
CREATE TABLE IF NOT EXISTS pay_terms_changes (
  id          BIGSERIAL PRIMARY KEY,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  before      JSONB,
  after       JSONB NOT NULL,
  reason      TEXT,
  changed_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pay_terms_changes_person_idx ON pay_terms_changes (person_id, changed_at DESC);

-- ── The approval steps of a timesheet ──────────────────────────────────────
ALTER TABLE tc_submissions DROP CONSTRAINT IF EXISTS tc_submissions_state_check;
ALTER TABLE tc_submissions ADD CONSTRAINT tc_submissions_state_check
  CHECK (state IN ('draft', 'submitted', 'hours_approved', 'approved', 'returned', 'recorded'));
ALTER TABLE tc_submissions ADD COLUMN IF NOT EXISTS hours_approved_by UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE tc_submissions ADD COLUMN IF NOT EXISTS hours_approved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS tc_approval_events (
  id             BIGSERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES tc_submissions(id) ON DELETE CASCADE,
  invoice_id     BIGINT,
  step           TEXT NOT NULL CHECK (step IN ('submit', 'hours', 'invoice', 'both', 'payroll', 'paid')),
  action         TEXT NOT NULL CHECK (action IN ('submit', 'approve', 'return', 'reopen', 'record', 'sent', 'refused', 'paid')),
  by_person      UUID REFERENCES people(id) ON DELETE SET NULL,
  at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  note           TEXT
);
CREATE INDEX IF NOT EXISTS tc_approval_events_submission_idx ON tc_approval_events (submission_id, at);

-- ── Invoices ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             BIGSERIAL PRIMARY KEY,
  number         TEXT NOT NULL UNIQUE,
  person_id      UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  -- Null for the fixed, no timesheet ones (made on day 1).
  submission_id  INTEGER UNIQUE REFERENCES tc_submissions(id) ON DELETE SET NULL,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('hourly', 'fixed_monthly', 'fixed_no_timesheet')),
  state          TEXT NOT NULL DEFAULT 'waiting' CHECK (state IN ('draft', 'waiting', 'approved', 'paid')),
  issued_on      DATE NOT NULL,
  due_on         DATE NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  total          NUMERIC(12, 2) NOT NULL,
  from_snapshot  JSONB NOT NULL,
  to_snapshot    JSONB NOT NULL,
  approved_by    UUID REFERENCES people(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ,
  paid_on        DATE,
  paid_ref       TEXT,
  paid_note      TEXT,
  paid_by        UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  CHECK (state <> 'paid' OR paid_on IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS invoices_person_idx ON invoices (person_id, period_start DESC);
CREATE INDEX IF NOT EXISTS invoices_state_idx ON invoices (state);
-- One invoice per person and month for the ones nobody submits.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_fixed_once ON invoices (person_id, period_start) WHERE kind = 'fixed_no_timesheet';

ALTER TABLE tc_approval_events DROP CONSTRAINT IF EXISTS tc_approval_events_invoice_fk;
ALTER TABLE tc_approval_events ADD CONSTRAINT tc_approval_events_invoice_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS tc_approval_events_invoice_idx ON tc_approval_events (invoice_id, at);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id                BIGSERIAL PRIMARY KEY,
  invoice_id        BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('hours', 'fixed', 'reimbursement')),
  client            TEXT,
  description       TEXT NOT NULL,
  hours_seconds     INTEGER,
  rate              NUMERIC(12, 2),
  amount            NUMERIC(12, 2) NOT NULL,
  reimbursement_id  BIGINT,
  sort              INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON invoice_lines (invoice_id, sort);

-- ── The one settings row ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_settings (
  singleton_id       INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  prefix             TEXT NOT NULL DEFAULT 'INV',
  next_number        INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0),
  rmb_prefix         TEXT NOT NULL DEFAULT 'RMB',
  rmb_next_number    INTEGER NOT NULL DEFAULT 1 CHECK (rmb_next_number > 0),
  billing_name       TEXT,
  billing_address    TEXT,
  billing_email      TEXT,
  payment_days       INTEGER NOT NULL DEFAULT 15 CHECK (payment_days BETWEEN 0 AND 120),
  -- Who approves invoices ("Approves invoices"); the first is the default for
  -- everyone who does not report to one of the others.
  invoice_approvers  UUID[] NOT NULL DEFAULT '{}',
  default_approver   UUID REFERENCES people(id) ON DELETE SET NULL,
  -- Their own timesheet is recorded without approval.
  deputy_director    UUID REFERENCES people(id) ON DELETE SET NULL,
  -- Marks invoices and reimbursements paid.
  finance            UUID[] NOT NULL DEFAULT '{}',
  updated_by         UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The owner's decisions of Oct 21, 2026: Arnaldo Oliveira and Dave Sharpe
-- approve invoices (Arnaldo by default), Dave is the Deputy Director, Tina
-- Gennette is Finance. Names are looked up, never assumed to exist (the
-- Directory has Dave as "David Sharpe").
INSERT INTO invoice_settings (singleton_id, billing_name, invoice_approvers, default_approver, deputy_director, finance)
SELECT 1, 'True North Digital Marketing',
       ARRAY(SELECT id FROM people WHERE full_name IN ('Arnaldo Oliveira', 'Dave Sharpe', 'David Sharpe') AND status = 'active' ORDER BY full_name),
       (SELECT id FROM people WHERE full_name = 'Arnaldo Oliveira' AND status = 'active' LIMIT 1),
       (SELECT id FROM people WHERE full_name IN ('Dave Sharpe', 'David Sharpe') AND status = 'active' LIMIT 1),
       ARRAY(SELECT id FROM people WHERE full_name = 'Tina Gennette' AND status = 'active')
ON CONFLICT (singleton_id) DO NOTHING;
-- A first run that missed Dave (the name above) is completed, never overwritten otherwise.
UPDATE invoice_settings SET
  invoice_approvers = ARRAY(SELECT DISTINCT unnest(invoice_approvers || ARRAY(SELECT id FROM people WHERE full_name IN ('Dave Sharpe', 'David Sharpe') AND status = 'active'))),
  deputy_director = (SELECT id FROM people WHERE full_name IN ('Dave Sharpe', 'David Sharpe') AND status = 'active' LIMIT 1)
WHERE singleton_id = 1 AND deputy_director IS NULL;

-- Takes the next number under a row lock: two invoices never share one.
CREATE OR REPLACE FUNCTION public.next_document_number(p_kind TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s invoice_settings%ROWTYPE;
  n INTEGER;
  y TEXT := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY');
BEGIN
  SELECT * INTO s FROM invoice_settings WHERE singleton_id = 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice settings missing'; END IF;
  IF p_kind = 'invoice' THEN
    n := s.next_number;
    UPDATE invoice_settings SET next_number = n + 1 WHERE singleton_id = 1;
    RETURN s.prefix || '-' || y || '-' || lpad(n::TEXT, 4, '0');
  ELSIF p_kind = 'reimbursement' THEN
    n := s.rmb_next_number;
    UPDATE invoice_settings SET rmb_next_number = n + 1 WHERE singleton_id = 1;
    RETURN s.rmb_prefix || '-' || y || '-' || lpad(n::TEXT, 4, '0');
  END IF;
  RAISE EXCEPTION 'unknown document kind %', p_kind;
END $$;
REVOKE ALL ON FUNCTION public.next_document_number(TEXT) FROM PUBLIC, anon, authenticated;

-- ── Nothing for the anonymous or signed-in role ────────────────────────────
ALTER TABLE pay_terms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_terms_changes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_approval_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_settings   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON pay_terms, pay_terms_changes, tc_approval_events, invoices, invoice_lines, invoice_settings
  FROM anon, authenticated;
REVOKE ALL ON SEQUENCE pay_terms_changes_id_seq, tc_approval_events_id_seq, invoices_id_seq, invoice_lines_id_seq
  FROM anon, authenticated;

-- ── The daily check (migrations 098, 113) watches them too ─────────────────
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
                        'invoice_settings']) t,
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
                        'tc_job_field_defaults(date,text[])','next_document_number(text)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
