-- Clocky part 2, the job catalogue (Job Catalogue.dc.html 11A to 11D): the
-- portal keeps the jobs, their fields and the clients; a Super Admin edits
-- them in Company settings > Job catalogue.
--
--   tc_jobcodes        when_to_use (the line under each job in the clock and
--                      on "Which job?"), default Company and Project, the
--                      order people see, and folder: a folder made in the
--                      portal is never clocked into, even before it has
--                      jobs (an imported one is a folder while it holds
--                      active jobs, as before)
--   edited_in_portal_at  on jobs and field options: QuickBooks Time's import
--                      keeps adding what is new there but no longer
--                      overwrites what was changed here
--   tc_field_option_use(field)          entries per option ("Used in")
--   tc_rename_field_option(option, label)  renames an option and the old
--                      entries with it, in one transaction
--
-- Both functions are for the server only.

BEGIN;

ALTER TABLE tc_jobcodes
  ADD COLUMN IF NOT EXISTS when_to_use TEXT CHECK (when_to_use IS NULL OR length(when_to_use) <= 400),
  ADD COLUMN IF NOT EXISTS default_company TEXT,
  ADD COLUMN IF NOT EXISTS default_project TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER,
  ADD COLUMN IF NOT EXISTS folder BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_in_portal_at TIMESTAMPTZ;
ALTER TABLE tc_field_options ADD COLUMN IF NOT EXISTS edited_in_portal_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.tc_field_option_use(p_field_id INTEGER)
RETURNS TABLE (label TEXT, entries BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fields ->> p_field_id::text AS label, count(*) AS entries
    FROM tc_entries
   WHERE fields ? p_field_id::text
   GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION public.tc_rename_field_option(p_option_id INTEGER, p_label TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o tc_field_options%ROWTYPE;
  n INTEGER;
BEGIN
  IF p_label IS NULL OR btrim(p_label) = '' THEN RAISE EXCEPTION 'empty label'; END IF;
  SELECT * INTO o FROM tc_field_options WHERE id = p_option_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such option'; END IF;
  IF EXISTS (SELECT 1 FROM tc_field_options WHERE field_id = o.field_id AND id <> o.id AND lower(label) = lower(btrim(p_label))) THEN
    RAISE EXCEPTION 'label taken';
  END IF;
  UPDATE tc_field_options SET label = btrim(p_label), edited_in_portal_at = now() WHERE id = o.id;
  UPDATE tc_entries SET fields = jsonb_set(fields, ARRAY[o.field_id::text], to_jsonb(btrim(p_label)))
   WHERE fields ->> o.field_id::text = o.label;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$$;

REVOKE ALL ON FUNCTION public.tc_field_option_use(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tc_rename_field_option(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

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
                        'tc_job_field_defaults(date,text[])','next_document_number(text)',
                        'tc_field_option_use(integer)','tc_rename_field_option(integer,text)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;
