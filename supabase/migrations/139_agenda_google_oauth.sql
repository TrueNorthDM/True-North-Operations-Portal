-- Agenda and Google Calendar, the connection (owner, 30 October 2026): the
-- portal's own Google app (project "True North Operations Portal", created by
-- office@) and the sign-in tokens of each connected account.
--
-- The client secret and the Picker key are entered by a Super Admin in
-- Company settings > Integrations, never in code. app_settings is already
-- closed to the anonymous and signed-in roles (migration 098). The tokens sit
-- in their own table, server only, so nothing that reads agenda_accounts ever
-- carries them.

BEGIN;

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_oauth_client_id     TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_oauth_client_secret TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_picker_key          TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_oauth_saved_by      UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS google_oauth_saved_at      TIMESTAMPTZ;

-- One row per account connected by Google sign-in. The refresh token lasts
-- until the person disconnects or removes the portal in their Google account;
-- the access token lasts an hour and is renewed from it.
CREATE TABLE IF NOT EXISTS agenda_account_tokens (
  account_id         BIGINT PRIMARY KEY REFERENCES agenda_accounts(id) ON DELETE CASCADE,
  refresh_token      TEXT NOT NULL,
  access_token       TEXT,
  access_expires_at  TIMESTAMPTZ,
  scopes             TEXT[] NOT NULL DEFAULT '{}',
  google_sub         TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agenda_account_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agenda_account_tokens FROM anon, authenticated;

-- ── The daily check watches it too ─────────────────────────────────────────
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
                        'tc_job_field_defaults(date,text[])','next_document_number(text)',
                        'agenda_booking_hold(uuid,timestamptz,timestamptz,integer,text,text,text[],text,text,text,text,timestamptz)',
                        'agenda_booking_confirm(text,integer)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;
