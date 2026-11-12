-- Zoom for the Agenda (owner, 12 November 2026): an online event takes a
-- Google Meet link or a Zoom link, as its creator chooses, one link an event.
-- Each person connects their own Zoom account in Agenda settings; the meeting
-- is made on it and its link goes in the Google invitation.
--
--   app_settings.zoom_*            the portal's Zoom app (Company settings >
--                                  Integrations), entered by a Super Admin
--   agenda_zoom_accounts           one row a person: who they are on Zoom and
--                                  their tokens. Server only.
--   agenda_person_settings.meeting_link
--                                  the person's default for a new online event
--   agenda_events.online_via       'meet' or 'zoom' (null reads as Meet)
--   agenda_events.zoom_meeting_id  the Zoom meeting the portal made for it,
--   agenda_events.zoom_person_id   and whose Zoom account it is on
--
-- Safe to run twice.

BEGIN;

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS zoom_client_id     TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS zoom_client_secret TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS zoom_saved_by      UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS zoom_saved_at      TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS agenda_zoom_accounts (
  person_id          UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  zoom_user_id       TEXT NOT NULL,
  email              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect')),
  refresh_token      TEXT NOT NULL,
  access_token       TEXT,
  access_expires_at  TIMESTAMPTZ,
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agenda_zoom_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agenda_zoom_accounts FROM anon, authenticated;

ALTER TABLE agenda_person_settings ADD COLUMN IF NOT EXISTS meeting_link TEXT NOT NULL DEFAULT 'meet';
ALTER TABLE agenda_person_settings DROP CONSTRAINT IF EXISTS agenda_person_settings_meeting_link_check;
ALTER TABLE agenda_person_settings ADD CONSTRAINT agenda_person_settings_meeting_link_check CHECK (meeting_link IN ('meet', 'zoom'));

ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS online_via      TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS zoom_person_id  UUID REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE agenda_events DROP CONSTRAINT IF EXISTS agenda_events_online_via_check;
ALTER TABLE agenda_events ADD CONSTRAINT agenda_events_online_via_check CHECK (online_via IN ('meet', 'zoom'));

-- The daily check watches the new table too.
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
                        'reimbursement_reports','agenda_zoom_accounts','invoice_form_codes','invoice_form_submissions',
                        'hr_settings','review_cycles','review_priorities','review_team_priorities','reviews',
                        'review_answers','review_goals','review_goal_updates','review_checkins',
                        'review_imports','review_log','review_notices',
                        'invoice_sends','reimbursement_changes',
                        'ts_clients','ts_topics','ts_pages','ts_topic_history']) t,
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
                        'agenda_booking_confirm(text,integer)','ts_import_topic(jsonb,uuid)','ts_patch_topic(uuid,jsonb,jsonb,uuid)','ts_save_page(uuid,jsonb,uuid)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;
