-- 122_reimbursement_reports.sql
--
-- Several receipts in one reimbursement request (owner, 2026-10-23): a trip
-- with the flight, the hotel, the Ubers and the meals goes as one request.
--
--   reimbursement_reports   the request: whose, its name ("Sao Paulo trip"),
--                           when it was sent
--   reimbursements.report_id  each receipt keeps its own row, date, category,
--                           amount, currency, client and billable; the report
--                           only groups them. A request with one receipt and
--                           no name has no report, as before.
--
-- Each receipt is still decided on its own (approved or denied, with a reason)
-- and goes on the invoice or the reimbursement document as its own line.
--
-- As 116: server writes only, nothing for the anonymous or signed-in role,
-- watched by the daily check. Safe to run again.

BEGIN;

CREATE TABLE IF NOT EXISTS reimbursement_reports (
  id          BIGSERIAL PRIMARY KEY,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reimbursement_reports_person_idx ON reimbursement_reports (person_id, created_at DESC);

ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS report_id BIGINT REFERENCES reimbursement_reports(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS reimbursements_report_idx ON reimbursements (report_id) WHERE report_id IS NOT NULL;

ALTER TABLE reimbursement_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reimbursement_reports FROM anon, authenticated;
REVOKE ALL ON SEQUENCE reimbursement_reports_id_seq FROM anon, authenticated;

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
                        'integration_jobs','people_type_changes','agenda_events','agenda_good_news',
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
