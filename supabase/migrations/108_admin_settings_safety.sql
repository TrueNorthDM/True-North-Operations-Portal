-- 108_admin_settings_safety.sql
--
-- Admin (audit, 10 October 2026, module 12, approved by Arnaldo the same day).
--
-- 1. app_settings (the Monday and TSheets API tokens, the Monday webhook
--    secret) is read and written by the server only. It was protected by the
--    admin profile role, which every Admin holds, while the APIs & tokens
--    section is Super Admin only: with the database gate open (found once
--    already) any Admin could read the full tokens over the REST API.
--
-- 2. settings_change_log: who changed a token or the webhook secret, and
--    when. Never the value.

BEGIN;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON app_settings', r.policyname);
  END LOOP;
END $$;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS settings_change_log (
  id              BIGSERIAL PRIMARY KEY,
  -- monday_api_token | tsheets_api_token | monday_webhook_secret
  setting         TEXT NOT NULL,
  -- set | cleared | regenerated
  action          TEXT NOT NULL,
  actor_person_id UUID,
  actor_name      TEXT,
  actor_email     TEXT,
  at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settings_change_log_at ON settings_change_log (at DESC);
ALTER TABLE settings_change_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON settings_change_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE settings_change_log_id_seq FROM anon, authenticated;

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
                        'prune_monday_events()']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
