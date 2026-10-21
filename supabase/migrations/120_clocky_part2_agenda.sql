-- Clocky part 2, the Agenda (Agenda.dc.html 8A to 8F): one calendar for the
-- company. Most of it is read from what the portal already keeps (approved
-- time off, birthdays, start dates, the company holidays); two things are new:
--
--   agenda_events      company events and milestones (Super Admins and
--                      Admins) and team events (Team Leaders), created in the
--                      portal; optionally copied to the team Google Calendar
--                      through the outbox (calendar_state, google_event_id)
--   agenda_good_news   the Good News Calendar, read in from Google every
--                      15 minutes at most; read only in the portal
--
-- Who sees an event is decided in app code (lib/agenda), so both tables are
-- read and written by the server only.

BEGIN;

CREATE TABLE IF NOT EXISTS agenda_events (
  id                 BIGSERIAL PRIMARY KEY,
  kind               TEXT NOT NULL CHECK (kind IN ('event', 'milestone')),
  -- Set on a team event: the team it belongs to (a Team Leader's own).
  team_id            UUID REFERENCES teams(id) ON DELETE CASCADE,
  title              TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  -- Set on an event at a time; both empty on an all-day one or a few days.
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  time_zone          TEXT,
  place              TEXT,
  -- Who sees it: empty is everyone, otherwise these teams.
  audience_team_ids  UUID[],
  client             TEXT,
  description        TEXT,
  add_to_google      BOOLEAN NOT NULL DEFAULT false,
  google_event_id    TEXT,
  calendar_state     TEXT CHECK (calendar_state IN ('waiting', 'done', 'failed')),
  created_by         UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK ((starts_at IS NULL) = (ends_at IS NULL)),
  CHECK (starts_at IS NULL OR (ends_at > starts_at AND time_zone IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS agenda_events_days_idx ON agenda_events (start_date, end_date);

CREATE TABLE IF NOT EXISTS agenda_good_news (
  google_event_id  TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  description      TEXT,
  html_link        TEXT,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agenda_good_news_days_idx ON agenda_good_news (start_date, end_date);

-- When the Good News Calendar was last read (Company settings > Integrations).
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS good_news_synced_at TIMESTAMPTZ;

ALTER TABLE agenda_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_good_news ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agenda_events FROM anon, authenticated;
REVOKE ALL ON agenda_good_news FROM anon, authenticated;
REVOKE ALL ON SEQUENCE agenda_events_id_seq FROM anon, authenticated;

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
                        'integration_jobs','people_type_changes','agenda_events','agenda_good_news']) t,
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
