-- 107_href_links_safety.sql
--
-- Href Links (audit, 10 October 2026, module 11, approved by Arnaldo the same
-- day).
--
-- 1. sites, pages, page_urls, confirmations and monday_events are read and
--    written by the server only. Any signed-in session could read and change
--    them over the REST API (every Href Links page, URL and confirmation, and
--    each site's Monday board, column ids and languages), and read the raw
--    webhook log, behind the database gate alone. Every reader in the portal
--    now uses the privileged client after deciding access in app code.
--
-- 2. A Monday delivery is processed once: delivery_key (Monday's trigger id,
--    or item, column and time) is unique, so a replay is refused.
--
-- 3. The webhook log keeps what it ignored ("skipped:") for 90 days.
--    prune_monday_events() is run by the daily health check.

BEGIN;

-- ── 1. Server only ─────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('sites', 'pages', 'page_urls', 'confirmations', 'monday_events')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE sites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_urls     ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sites, pages, page_urls, confirmations, monday_events FROM anon, authenticated;

-- ── 2. One delivery, once ──────────────────────────────────────────────────
ALTER TABLE monday_events ADD COLUMN IF NOT EXISTS delivery_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS monday_events_delivery_key ON monday_events (delivery_key)
  WHERE delivery_key IS NOT NULL;

-- ── 3. Retention ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prune_monday_events()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  DELETE FROM monday_events
   WHERE received_at < now() - INTERVAL '90 days'
     AND result LIKE '%skipped:%';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.prune_monday_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_monday_events() TO service_role;

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
                        'sites','pages','page_urls','confirmations','monday_events']) t,
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
                        'prune_monday_events()']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
