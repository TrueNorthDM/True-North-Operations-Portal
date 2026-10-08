-- 096_hours_approved_by_super_admins.sql
--
-- Who approves hours and time off: the Super Admins, for now (decided
-- 8 October 2026, in the audit).
--
-- Until now the approvers were a person's manager (people.manager_id) and the
-- leader of each of their teams (teams.leader_person_id). That column has not
-- been kept current since team positions (Lead/Member, migrations 040 and 095)
-- replaced it: in production it disagreed with the Lead position on 10 of the
-- 13 teams. The portal (lib/timeclock/approvers.ts) and these row rules now
-- give the same answer: every active Super Admin, for everybody but themselves.
--
-- Only the two functions change. Every policy from 061 keeps reading
-- tc_people_i_approve(), so none of them is touched.
--
-- To undo, run the two CREATE OR REPLACE statements from
-- 061_time_clock_policy_speed.sql (tc_people_i_approve) and
-- 059_time_clock_approvals.sql (tc_approves_for) again.

BEGIN;

-- Whether the signed-in person is an active Super Admin.
CREATE OR REPLACE FUNCTION tc_i_approve_hours()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM people me
    WHERE me.id = my_person_id()
      AND me.access_level = 'super_admin'
      AND me.status = 'active'
  )
$$;

-- The set the policies read: everybody but me, when I approve hours.
CREATE OR REPLACE FUNCTION tc_people_i_approve()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM people p
  WHERE tc_i_approve_hours() AND p.id <> my_person_id()
$$;

-- The per-row form from 059, kept in step though no policy reads it since 061.
CREATE OR REPLACE FUNCTION tc_approves_for(target UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tc_i_approve_hours() AND target <> my_person_id()
$$;

COMMIT;
