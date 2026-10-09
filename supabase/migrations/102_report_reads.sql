-- 102_report_reads.sql
--
-- The Report's reads, done by the database (audit, 9 October 2026, module 8).
--
-- The Report read the change log and the timeclock as rows and counted them in
-- the app. PostgREST hands back at most 1,000 rows a request, whatever limit
-- the query asks for, so on the Everyone view the Report was built on the
-- first 1,000 events of the log (all from the first morning, 21 August 2026)
-- and on half the hours or less. Each function here answers one question the
-- Report asks and returns it as a single JSON value, which has no row cap.
--
-- Every function applies the rules the current Monday snapshot applies, so the
-- past and the present count the same work:
--   - boards switched off are left out;
--   - a people column switched off (source 'off') is not a step;
--   - a people column whose stages are an empty list owns no deadline, so it
--     is not a step either;
--   - accounts hidden in Settings are left out.
--
-- Who is in scope is decided by the app (lib/report/scope.ts) and passed in as
-- Monday accounts or directory people. p_accounts NULL is everyone, which the
-- app passes only to someone allowed to see everyone. So these run only for
-- the server: SECURITY DEFINER, and no execute right for anon or a signed-in
-- user, who could otherwise ask for anyone's history.

BEGIN;

-- The change log rows the Report may count.
CREATE OR REPLACE FUNCTION public.report_counted_events(p_accounts BIGINT[])
RETURNS SETOF monday_assignment_events
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
    FROM monday_assignment_events e
    JOIN monday_boards b ON b.id = e.board_id AND b.included
    LEFT JOIN monday_board_steps s ON s.board_id = e.board_id AND s.people_col = e.people_col
    LEFT JOIN monday_users u ON u.id = e.monday_user_id
   WHERE (p_accounts IS NULL OR e.monday_user_id = ANY (p_accounts))
     AND COALESCE(s.source, '') <> 'off'
     AND CASE WHEN jsonb_typeof(s.stages) = 'array' THEN jsonb_array_length(s.stages) > 0 ELSE true END
     AND NOT COALESCE(u.hidden, false)
$$;

-- Every event of every step finished since p_since, from a year before it on:
-- a step finished last week may have landed on the person months ago, and
-- the held time runs from then. Ordered as they happened.
CREATE OR REPLACE FUNCTION public.report_span_events(p_accounts BIGINT[], p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT * FROM report_counted_events(p_accounts)
     WHERE occurred_at >= p_since - INTERVAL '365 days'
  ),
  finished AS (
    SELECT DISTINCT item_id, people_col, monday_user_id
      FROM ev WHERE event = 'done' AND occurred_at >= p_since
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'board_id', ev.board_id, 'item_id', ev.item_id, 'people_col', ev.people_col,
           'monday_user_id', ev.monday_user_id, 'event', ev.event,
           'due_date', ev.due_date, 'occurred_at', ev.occurred_at)
         ORDER BY ev.occurred_at, ev.id), '[]'::jsonb)
    FROM ev JOIN finished f USING (item_id, people_col, monday_user_id)
$$;

-- Since when each step still in someone's hands has been there: the first
-- hand-off (assigned or reopened) after the step was last finished or taken
-- off them. The first, not the last: a repeated "assigned" while they already
-- hold it is the log seeing the same thing twice, not a new hand-off.
--
-- Only steps open in the current snapshot, so "Open by age" counts what "Open
-- now" counts. Without it, every step the log first saw already done (and so
-- never saw finish) read as held since 21 August.
CREATE OR REPLACE FUNCTION public.report_open_since(p_accounts BIGINT[])
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT id, item_id, people_col, monday_user_id, event, occurred_at
      FROM report_counted_events(p_accounts)
     WHERE event IN ('assigned', 'reopened', 'done', 'unassigned')
  ),
  closed AS (
    SELECT DISTINCT ON (item_id, people_col, monday_user_id)
           item_id, people_col, monday_user_id, occurred_at, id
      FROM ev WHERE event IN ('done', 'unassigned')
     ORDER BY item_id, people_col, monday_user_id, occurred_at DESC, id DESC
  ),
  held AS (
    SELECT ev.item_id, ev.people_col, ev.monday_user_id, min(ev.occurred_at) AS since
      FROM ev LEFT JOIN closed c USING (item_id, people_col, monday_user_id)
     WHERE ev.event IN ('assigned', 'reopened')
       AND (c.id IS NULL OR (ev.occurred_at, ev.id) > (c.occurred_at, c.id))
     GROUP BY 1, 2, 3
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'item_id', h.item_id, 'people_col', h.people_col,
           'monday_user_id', h.monday_user_id, 'since', h.since)), '[]'::jsonb)
    FROM held h
   WHERE EXISTS (SELECT 1 FROM monday_assignments a
                  WHERE a.item_id = h.item_id AND a.people_col = h.people_col
                    AND a.monday_user_id = h.monday_user_id
                    AND a.status_done IS DISTINCT FROM true)
$$;

-- Steps arriving and finishing since p_since, for the Workload flow columns.
--
-- An arrival is a hand-off to someone who did not already hold the step.
-- Two kinds of "assigned" are not arrivals: the repeats (the step was already
-- with them), and each board's first read, when the log wrote down everything
-- that was already assigned at the time (21 August 2026 for most boards).
CREATE OR REPLACE FUNCTION public.report_flow_events(p_accounts BIGINT[], p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_read AS (
    SELECT board_id, min(detected_at) AS at FROM monday_assignment_events GROUP BY board_id
  ),
  ev AS (
    SELECT e.board_id, e.monday_user_id, e.event, e.occurred_at, e.detected_at,
           lag(e.event) OVER (PARTITION BY e.item_id, e.people_col, e.monday_user_id
                              ORDER BY e.occurred_at, e.id) AS before
      FROM report_counted_events(p_accounts) e
     WHERE e.event IN ('assigned', 'reopened', 'done', 'unassigned')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'monday_user_id', ev.monday_user_id, 'event', ev.event, 'occurred_at', ev.occurred_at)), '[]'::jsonb)
    FROM ev JOIN first_read f USING (board_id)
   WHERE ev.occurred_at >= p_since
     AND (ev.event = 'done'
          OR (ev.event = 'assigned'
              AND ev.detected_at >= f.at + INTERVAL '1 hour'
              AND (ev.before IS NULL OR ev.before IN ('done', 'unassigned'))))
$$;

-- Approved hours (approved or locked) per person since a day, in seconds.
CREATE OR REPLACE FUNCTION public.report_hours(p_people UUID[], p_since DATE)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(person_id, seconds), '{}'::jsonb) FROM (
    SELECT person_id, sum(duration_seconds) AS seconds
      FROM tc_entries
     WHERE person_id = ANY (p_people)
       AND state IN ('approved', 'locked')
       AND entry_date >= p_since
     GROUP BY person_id
  ) t
$$;

-- Approved hours per job code since a day, in seconds.
CREATE OR REPLACE FUNCTION public.report_jobcode_hours(p_codes INTEGER[], p_since DATE)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(jobcode_id, seconds), '{}'::jsonb) FROM (
    SELECT jobcode_id, sum(duration_seconds) AS seconds
      FROM tc_entries
     WHERE jobcode_id = ANY (p_codes)
       AND state IN ('approved', 'locked')
       AND entry_date >= p_since
     GROUP BY jobcode_id
  ) t
$$;

-- One person's approved hours since a day, per timeclock code, for the person
-- drawer: the code, the folder it sits in, and the seconds.
CREATE OR REPLACE FUNCTION public.report_person_hours(p_person UUID, p_since DATE)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', t.code, 'folder', t.folder, 'seconds', t.seconds)
                            ORDER BY t.seconds DESC), '[]'::jsonb)
    FROM (
      SELECT j.name AS code, p.name AS folder, sum(e.duration_seconds) AS seconds
        FROM tc_entries e
        LEFT JOIN tc_jobcodes j ON j.id = e.jobcode_id
        LEFT JOIN tc_jobcodes p ON p.id = j.parent_id
       WHERE e.person_id = p_person
         AND e.state IN ('approved', 'locked')
         AND e.entry_date >= p_since
       GROUP BY j.name, p.name
    ) t
$$;

REVOKE ALL ON FUNCTION public.report_counted_events(BIGINT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_span_events(BIGINT[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_open_since(BIGINT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_flow_events(BIGINT[], TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_hours(UUID[], DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_jobcode_hours(INTEGER[], DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.report_person_hours(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_counted_events(BIGINT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_span_events(BIGINT[], TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_open_since(BIGINT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_flow_events(BIGINT[], TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_hours(UUID[], DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_jobcode_hours(INTEGER[], DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.report_person_hours(UUID, DATE) TO service_role;

-- The daily check (migration 098) watches these too.
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
    SELECT f || ' callable by ' || r
      FROM unnest(ARRAY['merge_people(uuid,uuid)','merge_monday_links(uuid,uuid)','portal_can_sign_in(text)',
                        'portal_end_sessions(uuid)','portal_two_step_status(uuid)',
                        'monday_swap_board_assignments(bigint,uuid)','access_commit(jsonb,jsonb,jsonb)',
                        'set_person_teams(uuid,jsonb)',
                        'report_counted_events(bigint[])','report_span_events(bigint[],timestamptz)',
                        'report_open_since(bigint[])','report_flow_events(bigint[],timestamptz)',
                        'report_hours(uuid[],date)','report_jobcode_hours(integer[],date)',
                        'report_person_hours(uuid,date)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
