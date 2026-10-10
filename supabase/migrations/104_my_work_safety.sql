-- 104_my_work_safety.sql
--
-- My Work and the Monday sync (audit, 10 October 2026, module 9, approved by
-- Arnaldo the same day).
--
-- 1. The Monday tables are read and written by the server only. Any signed-in
--    session could read everyone's work list, the teams' priority orders and
--    the Monday accounts' emails straight over the REST API: "See everyone's
--    list" was enforced in app code alone, behind the database gate, and that
--    gate was found open once already (migration 098). Every reader in the
--    portal now uses the privileged client and decides access in app code.
--    monday_snapshot and monday_events (Publishing Goals, Href Links) are left
--    for their own modules.
--
-- 2. A board is written in one transaction with its history. The sync wrote
--    the change log first and the board after it: a board whose write failed
--    wrote the same changes again on every retry. monday_write_board() takes
--    the events and the staged rows together, and also moves an item that
--    changed boards: Monday keeps an item's id across boards, and the global
--    key (item, people column, account) made the destination board's write
--    fail until the old board was read again.
--
-- 3. Work that comes back after leaving for a setting is not new work. A step
--    switched off and on again, a step that stops and starts owning a
--    deadline, a board that left the listing and returned, and a new step on
--    a board already read: their rows are written once without "assigned"
--    events and without telling anybody (baseline_pending, cleared by the
--    sync once written).
--
-- 4. Clearing a wrong link sticks: a Monday account an admin cleared is not
--    linked again by email (auto_link false) until someone links it by hand.
--
-- 5. Counts the settings pages showed from the first 1,000 rows are counted
--    by the database (monday_assignment_counts).

BEGIN;

-- ── 1. Server only ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS monday_assignments_read            ON monday_assignments;
DROP POLICY IF EXISTS monday_assignments_admin_write     ON monday_assignments;
DROP POLICY IF EXISTS monday_assignment_events_read      ON monday_assignment_events;
DROP POLICY IF EXISTS monday_assignment_events_admin_write ON monday_assignment_events;
DROP POLICY IF EXISTS monday_board_steps_read            ON monday_board_steps;
DROP POLICY IF EXISTS monday_board_steps_admin_write     ON monday_board_steps;
DROP POLICY IF EXISTS monday_boards_read                 ON monday_boards;
DROP POLICY IF EXISTS monday_boards_admin_write          ON monday_boards;
DROP POLICY IF EXISTS monday_users_read                  ON monday_users;
DROP POLICY IF EXISTS monday_users_admin_write           ON monday_users;
DROP POLICY IF EXISTS monday_user_links_read             ON monday_user_links;
DROP POLICY IF EXISTS monday_user_links_admin_write      ON monday_user_links;
DROP POLICY IF EXISTS monday_team_priority_read          ON monday_team_priority;
DROP POLICY IF EXISTS monday_priority_grants_read        ON monday_priority_grants;
DROP POLICY IF EXISTS monday_priority_grants_admin_write ON monday_priority_grants;

REVOKE ALL ON monday_assignments, monday_assignment_events, monday_board_steps, monday_boards,
              monday_users, monday_user_links, monday_team_priority, monday_priority_grants,
              monday_assignments_staging, monday_sync_runs, monday_sync_lock
  FROM anon, authenticated;

-- ── 3. Rows that come back without events ──────────────────────────────────
ALTER TABLE monday_board_steps ADD COLUMN IF NOT EXISTS baseline_pending BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE monday_boards      ADD COLUMN IF NOT EXISTS baseline_pending BOOLEAN NOT NULL DEFAULT false;

-- ── 4. A cleared link sticks ───────────────────────────────────────────────
ALTER TABLE monday_users ADD COLUMN IF NOT EXISTS auto_link BOOLEAN NOT NULL DEFAULT true;

-- ── 2. One board, one transaction ──────────────────────────────────────────
-- p_events: the change-log rows for this board, as monday_assignment_events
-- columns. Repeats of a change already logged are ignored by the table's key.
CREATE OR REPLACE FUNCTION public.monday_write_board(p_board BIGINT, p_batch UUID, p_events JSONB)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  n INT;
BEGIN
  INSERT INTO monday_assignment_events
         (board_id, item_id, people_col, monday_user_id, event, from_value, to_value, status_done, due_date, occurred_at)
  SELECT board_id, item_id, people_col, monday_user_id, event, from_value, to_value, status_done, due_date, occurred_at
    FROM jsonb_to_recordset(COALESCE(p_events, '[]'::jsonb)) AS e(
           board_id BIGINT, item_id BIGINT, people_col TEXT, monday_user_id BIGINT, event TEXT,
           from_value TEXT, to_value TEXT, status_done BOOLEAN, due_date DATE, occurred_at TIMESTAMPTZ)
  ON CONFLICT (board_id, item_id, people_col, monday_user_id, event, occurred_at) DO NOTHING;

  -- An item that moved here from another board: its old row goes, without an
  -- event (the work did not change hands, the item changed boards).
  DELETE FROM monday_assignments a
   USING monday_assignments_staging s
   WHERE s.batch = p_batch AND s.board_id = p_board
     AND a.board_id <> p_board
     AND a.item_id = s.item_id AND a.people_col = s.people_col AND a.monday_user_id = s.monday_user_id;

  n := monday_swap_board_assignments(p_board, p_batch);
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.monday_write_board(BIGINT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monday_write_board(BIGINT, UUID, JSONB) TO service_role;

-- ── 5. Counts by the database ──────────────────────────────────────────────
-- { "accounts": { "<monday user id>": n }, "steps": { "<board>:<people col>": n } }
CREATE OR REPLACE FUNCTION public.monday_assignment_counts()
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'accounts', COALESCE((SELECT jsonb_object_agg(monday_user_id, n) FROM (
        SELECT monday_user_id, count(*) n FROM monday_assignments GROUP BY 1) a), '{}'::jsonb),
    'steps', COALESCE((SELECT jsonb_object_agg(board_id || ':' || people_col, n) FROM (
        SELECT board_id, people_col, count(*) n FROM monday_assignments GROUP BY 1, 2) s), '{}'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.monday_assignment_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monday_assignment_counts() TO service_role;

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
                        'monday_users','monday_user_links','monday_team_priority','monday_priority_grants']) t,
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
                        'monday_write_board(bigint,uuid,jsonb)','monday_assignment_counts()']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
