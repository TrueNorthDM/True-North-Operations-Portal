-- Agenda and Google Calendar, part 2 (owner, 30 October 2026): the new event
-- drawer. An event now has a type, says who it is for (Guests, Teams or True
-- North, everyone invited for real), whether it is online (a Meet link) or in
-- person, and which of the creator's Google accounts sends it. Old events keep
-- working: audience null is an event made before this, read as before.

BEGIN;

ALTER TABLE agenda_events
  ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('meeting', 'training', 'deadline', 'milestone', 'company', 'celebration')),
  ADD COLUMN IF NOT EXISTS audience TEXT CHECK (audience IN ('guests', 'teams', 'all')),
  ADD COLUMN IF NOT EXISTS how TEXT CHECK (how IN ('online', 'in_person')),
  ADD COLUMN IF NOT EXISTS meet_link TEXT,
  ADD COLUMN IF NOT EXISTS sent_from_account_id BIGINT REFERENCES agenda_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'sample', 'google')),
  ADD COLUMN IF NOT EXISTS sample_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS agenda_events_sample_key ON agenda_events (sample_key) WHERE sample_key IS NOT NULL;

-- Everyone invited: guests one by one, and the people of the chosen teams or of
-- True North, written out when the event is saved.
CREATE TABLE IF NOT EXISTS agenda_event_guests (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES agenda_events(id) ON DELETE CASCADE,
  person_id  UUID REFERENCES people(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  via        TEXT NOT NULL DEFAULT 'guest' CHECK (via IN ('guest', 'team', 'all')),
  response   TEXT NOT NULL DEFAULT 'needsAction' CHECK (response IN ('needsAction', 'accepted', 'declined', 'tentative'))
);
CREATE UNIQUE INDEX IF NOT EXISTS agenda_event_guests_key ON agenda_event_guests (event_id, lower(email));
CREATE INDEX IF NOT EXISTS agenda_event_guests_person_idx ON agenda_event_guests (person_id);

ALTER TABLE agenda_event_guests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agenda_event_guests FROM anon, authenticated;
REVOKE ALL ON SEQUENCE agenda_event_guests_id_seq FROM anon, authenticated;

-- Who may send an event to all of True North: a Super Admin chooses the levels.
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS agenda_all_levels TEXT[] NOT NULL DEFAULT ARRAY['super_admin', 'admin']::text[];
COMMENT ON COLUMN app_settings.agenda_all_levels IS
  'Access levels that may invite all of True North to an event (super_admin, admin, team_leader, user). Super Admin only, Agenda settings.';

-- ── The daily check watches the guests too ─────────────────────────────────
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
