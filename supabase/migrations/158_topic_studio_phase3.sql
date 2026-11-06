-- 158_topic_studio_phase3.sql
--
-- Topic Studio, phase 3, Claude inside the tool (owner, 6 November 2026). Safe to
-- run again. Server only, as 155 to 157: RLS on, nothing for the anonymous or
-- signed-in role, watched by the daily check.
--
--   ts_settings   the tool's settings, one JSON row per area (key 'main'): which
--                 Claude features are on and with which model and effort, the
--                 daily limit and cooldown, models that may not be used, the
--                 prompts an Admin edited, which tabs and fields are on, and the
--                 feedback rules. Missing keys fall back to the defaults in code.
--   ts_ai_usage   one row per Claude run (who, which feature, which topic, which
--                 model, tokens, how long, whether it worked): the limit check
--                 and the usage log Admins read.

BEGIN;

CREATE TABLE IF NOT EXISTS ts_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES people(id) ON DELETE SET NULL
);
COMMENT ON TABLE ts_settings IS 'Topic Studio: settings by area (AI features and prompts, features, feedback rules).';

CREATE TABLE IF NOT EXISTS ts_ai_usage (
  id             BIGSERIAL PRIMARY KEY,
  at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  person_id      UUID REFERENCES people(id) ON DELETE SET NULL,
  topic_id       UUID REFERENCES ts_topics(id) ON DELETE SET NULL,
  topic_name     TEXT NOT NULL DEFAULT '',
  feature        TEXT NOT NULL,
  model          TEXT NOT NULL DEFAULT '',
  ok             BOOLEAN NOT NULL,
  error          TEXT NOT NULL DEFAULT '',
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  ms             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ts_ai_usage_person_idx ON ts_ai_usage (person_id, at DESC);
CREATE INDEX IF NOT EXISTS ts_ai_usage_at_idx ON ts_ai_usage (at DESC);
COMMENT ON TABLE ts_ai_usage IS 'Topic Studio: one row per Claude run, for the daily limit and the usage log.';

ALTER TABLE ts_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ts_settings, ts_ai_usage FROM anon, authenticated;
REVOKE ALL ON SEQUENCE ts_ai_usage_id_seq FROM anon, authenticated;

COMMIT;

-- db_protections_check also watches the two new tables (as in 157).
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
                        'reimbursement_reports','invoice_form_codes','invoice_form_submissions',
                        'hr_settings','review_cycles','review_priorities','review_team_priorities','reviews',
                        'review_answers','review_goals','review_goal_updates','review_checkins',
                        'review_imports','review_log','review_notices',
                        'invoice_sends','reimbursement_changes',
                        'ts_clients','ts_topics','ts_pages','ts_topic_history','ts_drafts','ts_draft_versions','ts_feedback','ts_settings','ts_ai_usage']) t,
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
                        'agenda_booking_confirm(text,integer)','ts_import_topic(jsonb,uuid)','ts_patch_topic(uuid,jsonb,jsonb,uuid)','ts_save_page(uuid,jsonb,uuid)','ts_save_draft(uuid,text,integer,uuid)','ts_add_version(uuid,text,text,text,integer,uuid)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

NOTIFY pgrst, 'reload schema';
