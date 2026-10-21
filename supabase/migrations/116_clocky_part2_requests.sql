-- 116_clocky_part2_requests.sql
--
-- Clocky part 2, step 2 (docs/time-clock/06-clocky-part2-design.md): the
-- requests people make and what the portal sends out for them.
--
--   reimbursements           a receipt and an amount; approved, it goes on the
--                            contractor's next invoice or the employee's
--                            reimbursement document
--   reimbursement_documents  RMB-YYYY-NNNN, what Finance pays an employee
--   extra_hours_requests     hours over the allowance asked before, decided by
--                            the invoice approver (README_PART2)
--   tc_absence_requests      time off gains Unpaid, the Rippling and calendar
--                            states, and a cancel asked of a Super Admin
--   integration_jobs         the outbox: what goes to Rippling and Google
--                            Calendar, retried and shown, never blocking a
--                            decision
--
-- As 113 and 115: server writes only, nothing for the anonymous or signed-in
-- role, watched by the daily check. Safe to run again.

BEGIN;

-- ── Reimbursement documents (employees) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS reimbursement_documents (
  id          BIGSERIAL PRIMARY KEY,
  number      TEXT NOT NULL UNIQUE,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  total       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  state       TEXT NOT NULL DEFAULT 'approved' CHECK (state IN ('approved', 'paid')),
  paid_on     DATE,
  paid_ref    TEXT,
  paid_note   TEXT,
  paid_by     UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (state <> 'paid' OR paid_on IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS reimbursement_documents_person_idx ON reimbursement_documents (person_id, created_at DESC);

-- ── Reimbursements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reimbursements (
  id            BIGSERIAL PRIMARY KEY,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  spent_on      DATE NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('Internet', 'Software', 'Equipment', 'Travel', 'Meals with a client', 'Other')),
  amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  -- USD on invoices; another currency keeps its code and Finance converts at the expense date.
  currency      TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  purpose       TEXT NOT NULL,
  client        TEXT,
  billable      BOOLEAN NOT NULL DEFAULT false,
  -- Private storage path of the receipt (photo or PDF); required.
  receipt_path  TEXT NOT NULL,
  receipt_name  TEXT,
  receipt_size  INTEGER,
  state         TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'denied', 'on_invoice', 'paid')),
  asked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by    UUID REFERENCES people(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  invoice_id    BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  document_id   BIGINT REFERENCES reimbursement_documents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS reimbursements_person_idx ON reimbursements (person_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS reimbursements_state_idx ON reimbursements (state);

ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_reimbursement_fk;
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_reimbursement_fk FOREIGN KEY (reimbursement_id) REFERENCES reimbursements(id) ON DELETE SET NULL;

-- ── Extra hours, asked before going over ───────────────────────────────────
CREATE TABLE IF NOT EXISTS extra_hours_requests (
  id            BIGSERIAL PRIMARY KEY,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  -- The person, or their Team Leader for them.
  asked_by      UUID REFERENCES people(id) ON DELETE SET NULL,
  hours         NUMERIC(6, 2) NOT NULL CHECK (hours > 0),
  period        TEXT NOT NULL CHECK (period IN ('week', 'month')),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  client        TEXT,
  reason        TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'denied')),
  asked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by    UUID REFERENCES people(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  CHECK (period_end >= period_start)
);
CREATE INDEX IF NOT EXISTS extra_hours_person_idx ON extra_hours_requests (person_id, period_start);

-- ── Time off: Unpaid, Rippling, the calendar, cancelling ───────────────────
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS rippling_state   TEXT CHECK (rippling_state IN ('waiting_connection', 'queued', 'sent', 'refused'));
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS rippling_error   TEXT;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS rippling_sent_at TIMESTAMPTZ;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS calendar_state   TEXT CHECK (calendar_state IN ('waiting_connection', 'queued', 'done', 'failed'));
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS entries_written_at TIMESTAMPTZ;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS cancel_asked_at  TIMESTAMPTZ;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS cancel_reason    TEXT;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMPTZ;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS cancelled_by     UUID REFERENCES people(id) ON DELETE SET NULL;

-- ── The outbox ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_jobs (
  id               BIGSERIAL PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('rippling_pto', 'rippling_pto_cancel', 'rippling_hours', 'gcal_upsert', 'gcal_delete')),
  ref_table        TEXT NOT NULL,
  ref_id           BIGINT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  state            TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('waiting_connection', 'queued', 'done', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS integration_jobs_due_idx ON integration_jobs (state, next_at);
CREATE INDEX IF NOT EXISTS integration_jobs_ref_idx ON integration_jobs (ref_table, ref_id);

-- ── The connections (Company settings > Integrations, 13A) ──────────────────
-- Entered by a Super Admin in the portal, never in code. app_settings is
-- already closed to the anonymous and signed-in roles (migration 098).
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS rippling_api_token        TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS rippling_connected_as     TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS rippling_checked_at       TIMESTAMPTZ;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_service_account    TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_team_calendar_id   TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_good_news_calendar_id TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_checked_at         TIMESTAMPTZ;

-- ── Nothing for the anonymous or signed-in role ────────────────────────────
ALTER TABLE reimbursement_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_hours_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_jobs        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reimbursement_documents, reimbursements, extra_hours_requests, integration_jobs FROM anon, authenticated;
REVOKE ALL ON SEQUENCE reimbursement_documents_id_seq, reimbursements_id_seq, extra_hours_requests_id_seq, integration_jobs_id_seq
  FROM anon, authenticated;

-- ── The daily check watches them too ───────────────────────────────────────
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
                        'integration_jobs']) t,
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
