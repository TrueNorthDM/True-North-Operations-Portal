-- Agenda and Google Calendar, part 1 (owner, 30 October 2026): the Google
-- accounts each person connects, their working hours and the busy times the
-- Agenda reads to find a time.
--
-- Google is not connected yet. Until it is, accounts and busy times come from
-- the portal itself (source 'sample', seeded on staging for the training
-- sessions); when Google is connected the same tables are filled from it
-- (source 'google'). Server only, like the rest of the Agenda (migration 120).

BEGIN;

-- ── Google accounts ─────────────────────────────────────────────────────────
-- One row per connected Google account. person_id null is the team calendar
-- (office@), which a Super Admin connects.
CREATE TABLE IF NOT EXISTS agenda_accounts (
  id             BIGSERIAL PRIMARY KEY,
  person_id      UUID REFERENCES people(id) ON DELETE CASCADE,
  team_calendar  BOOLEAN NOT NULL DEFAULT false,
  email          TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'sample' CHECK (source IN ('sample', 'google')),
  status         TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect')),
  connected_by   UUID REFERENCES people(id) ON DELETE SET NULL,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at   TIMESTAMPTZ,
  CHECK (team_calendar = (person_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS agenda_accounts_email_key ON agenda_accounts (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS agenda_accounts_team_calendar_key ON agenda_accounts (team_calendar) WHERE team_calendar;
CREATE INDEX IF NOT EXISTS agenda_accounts_person_idx ON agenda_accounts (person_id);

-- ── Each person's Agenda settings ───────────────────────────────────────────
-- working_hours: minutes from midnight in the person's own time zone, by ISO
-- weekday ("1" Monday to "7" Sunday), several blocks a day, e.g.
-- {"1": [[420, 660], [780, 1080]]}. A missing day is not a working day.
-- invite_account_id: "Invitations to you go to"; null is the work address.
CREATE TABLE IF NOT EXISTS agenda_person_settings (
  person_id          UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  working_hours      JSONB NOT NULL DEFAULT '{"1":[[540,1080]],"2":[[540,1080]],"3":[[540,1080]],"4":[[540,1080]],"5":[[540,1080]]}'::jsonb
                     CHECK (jsonb_typeof(working_hours) = 'object'),
  invite_account_id  BIGINT REFERENCES agenda_accounts(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Busy times ──────────────────────────────────────────────────────────────
-- Only when an account is busy, never what the event is.
CREATE TABLE IF NOT EXISTS agenda_busy (
  id          BIGSERIAL PRIMARY KEY,
  account_id  BIGINT NOT NULL REFERENCES agenda_accounts(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  source      TEXT NOT NULL DEFAULT 'sample' CHECK (source IN ('sample', 'google')),
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS agenda_busy_account_idx ON agenda_busy (account_id, starts_at);

ALTER TABLE agenda_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_person_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_busy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agenda_accounts, agenda_person_settings, agenda_busy FROM anon, authenticated;
REVOKE ALL ON SEQUENCE agenda_accounts_id_seq, agenda_busy_id_seq FROM anon, authenticated;

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
                        'integration_jobs','people_type_changes','agenda_events',
                        'agenda_accounts','agenda_person_settings','agenda_busy',
                        'reimbursement_reports']) t,
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
