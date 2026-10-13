-- 110_my_work_list.sql
--
-- My Work's list in one read (audit, 13 October 2026, approved by Arnaldo the
-- same day).
--
-- The work list was read 1,000 rows at a time, because PostgREST hands back
-- at most 1,000 rows a request: five round trips for the Everyone view, and
-- one per thousand rows for the Report's uncapped read of everyone's open
-- work. It also read the pages one after another while the sync was writing,
-- so a row could cross a page edge and be read twice or not at all.
-- my_work_list() returns the same rows, with the same columns, filters and
-- order, as a single JSON value, which has no row cap.
--
-- Who is in scope is decided by the app (lib/monday/worklist/data.ts: the
-- access items, the ?person and ?team clamps, the boards switched off, the
-- accounts hidden in Settings) and passed in. p_accounts NULL is everyone,
-- which the app passes only to someone allowed to see everyone. So it runs
-- only for the server: SECURITY DEFINER, and no execute right for anon or a
-- signed-in user, who could otherwise ask for anyone's work.
--
--   p_board_ids        boards whose work is read (the ones switched on)
--   p_hidden_accounts  Monday accounts left out (hidden in Settings)
--   p_accounts         only these Monday accounts; NULL is everyone
--   p_open_only        open steps only, no finished work at all
--   p_done_since       finished work changed since then is kept as well;
--                      NULL keeps all of it (ignored with p_open_only)
--   p_limit            at most this many rows, open and soonest first; NULL
--                      is every row

BEGIN;

CREATE OR REPLACE FUNCTION public.my_work_list(
  p_board_ids BIGINT[], p_hidden_accounts BIGINT[], p_accounts BIGINT[],
  p_open_only BOOLEAN, p_done_since TIMESTAMPTZ, p_limit INTEGER)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r)
           ORDER BY r.status_done ASC NULLS FIRST, r.due_date ASC NULLS LAST, r.id ASC), '[]'::jsonb)
    FROM (
      SELECT a.id, a.board_id, a.item_id, a.item_name, a.parent_item_name, a.parent_item_id,
             a.parent_board_id, a.group_title, a.people_col, a.monday_user_id, a.status_text,
             a.status_done, a.status_color, a.due_date, a.item_updated_at, a.status_col,
             a.due_col, a.item_language
        FROM monday_assignments a
       WHERE a.board_id = ANY (COALESCE(p_board_ids, '{}'))
         AND NOT (a.monday_user_id = ANY (COALESCE(p_hidden_accounts, '{}')))
         AND (p_accounts IS NULL OR a.monday_user_id = ANY (p_accounts))
         AND (a.status_done IS NOT TRUE
              OR (NOT COALESCE(p_open_only, false)
                  AND (p_done_since IS NULL OR a.item_updated_at >= p_done_since)))
       ORDER BY a.status_done ASC NULLS FIRST, a.due_date ASC NULLS LAST, a.id ASC
       LIMIT p_limit
    ) r
$$;

REVOKE ALL ON FUNCTION public.my_work_list(BIGINT[], BIGINT[], BIGINT[], BOOLEAN, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_work_list(BIGINT[], BIGINT[], BIGINT[], BOOLEAN, TIMESTAMPTZ, INTEGER)
  TO service_role;

-- ── The daily check (migration 098) watches this too ───────────────────────
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
                        'app_settings','settings_change_log']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'SELECT')
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
                        'my_work_list(bigint[],bigint[],bigint[],boolean,timestamptz,integer)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
