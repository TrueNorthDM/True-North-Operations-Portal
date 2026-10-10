-- 106_publishing_goals.sql
--
-- Publishing Goals (audit, 10 October 2026, module 10, approved by Arnaldo the
-- same day).
--
-- 1. monday_snapshot (whole publishing boards: items, people, activity) and
--    publishing_targets are read and written by the server only. Any signed-in
--    session could read them over the REST API, and anyone with an admin
--    profile could write the targets there, behind the database gate alone.
--
-- 2. Who counts as a publisher is a list in Settings (publishing_publishers),
--    not two names written into the code twice.
--
-- 3. A target keeps its history (publishing_target_periods): a change applies
--    from the week it is made, and past weeks keep the target they had. They
--    used to be judged again against every new target.
--
-- 4. Removing a target records who removed it: the change log took the actor
--    from the row's last editor, so it named whoever edited it before.
--    publishing_set_target() and publishing_remove_target() write the target,
--    its period and the actor in one transaction.

BEGIN;

-- ── 1. Server only ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS monday_snapshot_read          ON monday_snapshot;
DROP POLICY IF EXISTS publishing_targets_read        ON publishing_targets;
DROP POLICY IF EXISTS publishing_targets_admin_write ON publishing_targets;
REVOKE ALL ON monday_snapshot, publishing_targets FROM anon, authenticated;

-- ── 2. Publishers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_publishers (
  name       TEXT PRIMARY KEY,           -- exactly as Monday shows the person
  added_by   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS publishing_publishers_lower ON publishing_publishers (lower(name));
ALTER TABLE publishing_publishers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON publishing_publishers FROM anon, authenticated;
INSERT INTO publishing_publishers (name, added_by) VALUES
  ('Samuel Manzi', 'migration 106'), ('Wendy Cacka', 'migration 106')
ON CONFLICT DO NOTHING;

-- ── 3. Target periods ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_target_periods (
  id           BIGSERIAL PRIMARY KEY,
  board_id     TEXT NOT NULL,
  language     TEXT NOT NULL,
  target_value INTEGER NOT NULL CHECK (target_value >= 0),
  valid_from   DATE NOT NULL,             -- a Monday, New York
  valid_to     DATE,                      -- the Sunday it ended; null while in force
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (board_id, language, valid_from)
);
ALTER TABLE publishing_target_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON publishing_target_periods FROM anon, authenticated;
REVOKE ALL ON SEQUENCE publishing_target_periods_id_seq FROM anon, authenticated;

-- Today's targets, in force for as far back as anyone looks: before this
-- migration there was no history to say otherwise.
INSERT INTO publishing_target_periods (board_id, language, target_value, valid_from)
SELECT board_id, language, target_value, DATE '2020-01-06'
  FROM publishing_targets WHERE period_type = 'weekly'
ON CONFLICT DO NOTHING;

-- p_week: the Monday (New York) of the week the change is made.
CREATE OR REPLACE FUNCTION public.publishing_set_target(
  p_board TEXT, p_short TEXT, p_language TEXT, p_value INTEGER, p_actor TEXT, p_week DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_value IS NULL OR p_value < 0 THEN RAISE EXCEPTION 'target must be a whole number of 0 or more'; END IF;

  INSERT INTO publishing_targets (board_id, board_short, language, target_value, period_type, updated_by)
  VALUES (p_board, p_short, p_language, p_value, 'weekly', p_actor)
  ON CONFLICT (board_id, language, period_type)
  DO UPDATE SET target_value = EXCLUDED.target_value, updated_by = EXCLUDED.updated_by;

  -- A period opened this week is corrected in place; an older one is closed
  -- the Sunday before and a new one opens this Monday.
  UPDATE publishing_target_periods SET target_value = p_value
   WHERE board_id = p_board AND language = p_language AND valid_to IS NULL AND valid_from >= p_week;
  IF NOT FOUND THEN
    UPDATE publishing_target_periods SET valid_to = p_week - 1
     WHERE board_id = p_board AND language = p_language AND valid_to IS NULL;
    INSERT INTO publishing_target_periods (board_id, language, target_value, valid_from)
    VALUES (p_board, p_language, p_value, p_week)
    ON CONFLICT (board_id, language, valid_from) DO UPDATE SET target_value = EXCLUDED.target_value, valid_to = NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.publishing_remove_target(p_id UUID, p_actor TEXT, p_week DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t publishing_targets%ROWTYPE;
BEGIN
  -- Stamped first, so the change log's delete row names who removed it.
  UPDATE publishing_targets SET updated_by = p_actor WHERE id = p_id RETURNING * INTO t;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM publishing_targets WHERE id = p_id;

  -- Gone from this week on; a period that only began this week goes too.
  DELETE FROM publishing_target_periods
   WHERE board_id = t.board_id AND language = t.language AND valid_to IS NULL AND valid_from >= p_week;
  UPDATE publishing_target_periods SET valid_to = p_week - 1
   WHERE board_id = t.board_id AND language = t.language AND valid_to IS NULL;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.publishing_set_target(TEXT, TEXT, TEXT, INTEGER, TEXT, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publishing_remove_target(UUID, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publishing_set_target(TEXT, TEXT, TEXT, INTEGER, TEXT, DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.publishing_remove_target(UUID, TEXT, DATE) TO service_role;

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
                        'monday_snapshot','publishing_targets','publishing_target_periods','publishing_publishers']) t,
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
                        'publishing_remove_target(uuid,text,date)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
