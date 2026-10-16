-- 113_clocky_writes_server_only.sql
--
-- Hours are written by the server only (Clocky, step 1; audit findings C1, C2
-- and N5 of docs/time-clock/03-survey-2026-10-15.md).
--
-- Until now a signed-in session could write tc_entries, tc_submissions,
-- tc_absence_requests and tc_entry_audit straight over the REST API, under the
-- row rules of migrations 058 to 061:
--
--   C1  an Admin could rewrite or delete their own submitted, approved or
--       imported entries: the blanket is_admin rule (FOR ALL) let it through;
--   C2  hours could be added into a submitted or approved month: only the
--       screen stopped it;
--   N5  Admins could approve hours and time off, which only Super Admins do
--       (8 October 2026), through the same blanket rule.
--
-- Clocky decides every write in app code (lib/timeclock/scope.ts, the lock
-- rule, shorten-only, a reason for every change) and then writes with the
-- privileged client. The database's part is to refuse everything else, so
-- these tables, and the two that decide what a period is (tc_periods,
-- tc_settings: deleting a period would delete its submissions and unlock it;
-- the pay period start decides every pay period), take no write from the
-- anonymous or the signed-in role. Reading is unchanged: a person still reads
-- their own rows and an admin all of them, under the rules that were there.
--
-- Every writer in the portal was moved to the privileged client in the same
-- change (app/(app)/hours, app/(app)/clocky-hours, lib/timeclock), so no
-- screen loses a save.

BEGIN;

-- ── The row rules that allowed writing ─────────────────────────────────────
DROP POLICY IF EXISTS tc_entries_own_insert          ON tc_entries;
DROP POLICY IF EXISTS tc_entries_own_update          ON tc_entries;
DROP POLICY IF EXISTS tc_entries_approver_update     ON tc_entries;
DROP POLICY IF EXISTS tc_entries_own_delete          ON tc_entries;
DROP POLICY IF EXISTS tc_submissions_own_insert      ON tc_submissions;
DROP POLICY IF EXISTS tc_submissions_own_update      ON tc_submissions;
DROP POLICY IF EXISTS tc_submissions_approver_update ON tc_submissions;
DROP POLICY IF EXISTS tc_absence_own_insert          ON tc_absence_requests;
DROP POLICY IF EXISTS tc_absence_own_update          ON tc_absence_requests;
DROP POLICY IF EXISTS tc_absence_approver_update     ON tc_absence_requests;
DROP POLICY IF EXISTS tc_entry_audit_insert          ON tc_entry_audit;

-- ── The admin blanket becomes reading only, and the grants go ──────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tc_entries', 'tc_submissions', 'tc_absence_requests', 'tc_entry_audit', 'tc_periods', 'tc_settings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING ((SELECT is_admin(auth.uid())))',
      t || '_admin_read', t
    );
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON %I FROM authenticated', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;

REVOKE ALL ON SEQUENCE tc_entries_id_seq, tc_entry_audit_id_seq, tc_submissions_id_seq,
                       tc_absence_requests_id_seq, tc_periods_id_seq
  FROM anon, authenticated;

-- ── The daily check (migration 098) watches these too ──────────────────────
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
                        'tc_pay_period_anchors','tc_safety_events']) t,
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
                        'tc_job_field_defaults(date,text[])']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
