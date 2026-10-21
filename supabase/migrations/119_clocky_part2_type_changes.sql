-- Clocky part 2, contractor to employee (Company Settings.dc.html 10A-3,
-- 10A-4): a Super Admin schedules the day a contractor joins Rippling
-- payroll. Until then nothing changes; from that day they submit every 2
-- weeks (tc_person_cadence, written when it is scheduled) and, on the day,
-- the daily job turns them into a US employee. Cancelling before the day
-- removes both. Read and written by the server only.

BEGIN;

CREATE TABLE IF NOT EXISTS people_type_changes (
  id            BIGSERIAL PRIMARY KEY,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  to_type       TEXT NOT NULL CHECK (to_type IN ('us')),
  effective_on  DATE NOT NULL,
  note          TEXT,
  state         TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'applied', 'cancelled')),
  scheduled_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at    TIMESTAMPTZ,
  cancelled_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  cancelled_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS people_type_changes_due_idx ON people_type_changes (state, effective_on);
-- One change waiting per person.
CREATE UNIQUE INDEX IF NOT EXISTS people_type_changes_one ON people_type_changes (person_id) WHERE state = 'scheduled';

ALTER TABLE people_type_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON people_type_changes FROM anon, authenticated;
REVOKE ALL ON SEQUENCE people_type_changes_id_seq FROM anon, authenticated;

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
                        'integration_jobs','people_type_changes']) t,
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
