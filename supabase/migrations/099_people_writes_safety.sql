-- 099_people_writes_safety.sql
--
-- Two guards for writes to people (audit, 8 October 2026, module 4):
--
-- 1. One GoodNews address per person. It is the address a first sign-in is
--    linked by (the sign-up trigger, migration 095), so two people holding the
--    same one could link a new login to the wrong person, and with it their
--    access. The portal checks every company mailbox before saving; this
--    makes the one that links logins impossible to repeat. Production had no
--    duplicates when this was written.
--
-- 2. A person's teams replaced in one transaction. The portal deleted the old
--    memberships and then inserted the new ones as two requests: a failed
--    insert left the person on no team at all, and with it no Team Leader
--    level. set_person_teams() does both or neither.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS people_email_goodnews_unique
  ON people (lower(email_goodnews))
  WHERE email_goodnews IS NOT NULL;

-- p_teams: [{ "team_id": uuid, "position": "lead" | "member", "is_primary": bool }]
CREATE OR REPLACE FUNCTION public.set_person_teams(p_person UUID, p_teams JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM team_members WHERE person_id = p_person;
  INSERT INTO team_members (team_id, person_id, position, is_primary)
  SELECT (t->>'team_id')::UUID, p_person, t->>'position', COALESCE((t->>'is_primary')::BOOLEAN, false)
    FROM jsonb_array_elements(COALESCE(p_teams, '[]'::jsonb)) t;
END $$;

REVOKE ALL ON FUNCTION public.set_person_teams(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_person_teams(UUID, JSONB) TO service_role;

-- The daily check (migration 098) watches this one too.
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
                        'set_person_teams(uuid,jsonb)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
