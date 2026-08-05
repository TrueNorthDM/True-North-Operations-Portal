-- 059_time_clock_approvals.sql
--
-- Phase 3: submit and approve. Today this happens by email, which means the
-- decision exists but leaves no record anyone can query, and "who approved
-- March" is answerable only by searching an inbox.
--
-- WHO APPROVES WHOM. Two links already exist in the directory and both are
-- real: teams.leader_person_id, and people.manager_id. Using only one leaves
-- people whose timesheet nobody can approve, which is the worst outcome here:
-- a submitted month that sits forever. So either may approve, and in practice
-- it is one person. Where both exist, whoever gets there first signs it.
--
-- WHAT THE POLICIES ENFORCE. Postgres cannot compare the old row with the new
-- one inside a policy: USING sees what is there, WITH CHECK sees what it would
-- become. That is enough to express the transitions that matter by pairing them:
--
--   person:   USING state = 'open'        WITH CHECK state IN ('open','submitted')
--   approver: USING state = 'submitted'   WITH CHECK state IN ('submitted','approved','open')
--
-- So a person may submit but never approve their own hours, and an approver may
-- approve or hand back, but cannot reach into an open week and change it.

-- ─── Who may sign off for whom ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION tc_approves_for(target UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- their manager on the org chart
    SELECT 1 FROM people p
    WHERE p.id = target AND p.manager_id = my_person_id()
  ) OR EXISTS (
    -- the leader of a team they are on
    SELECT 1
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.person_id = target AND t.leader_person_id = my_person_id()
  );
$$;

-- ─── Pay periods ────────────────────────────────────────────────────────────
-- Just date ranges. Everyone needs to read them to know which month they are
-- submitting; only admins create or close them (057's policy).

DROP POLICY IF EXISTS tc_periods_read ON tc_periods;
CREATE POLICY tc_periods_read ON tc_periods
  FOR SELECT TO authenticated USING (true);

-- ─── Submissions ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_submissions_read ON tc_submissions;
CREATE POLICY tc_submissions_read ON tc_submissions
  FOR SELECT TO authenticated
  USING (person_id = my_person_id() OR tc_approves_for(person_id));

DROP POLICY IF EXISTS tc_submissions_own_insert ON tc_submissions;
CREATE POLICY tc_submissions_own_insert ON tc_submissions
  FOR INSERT TO authenticated
  WITH CHECK (person_id = my_person_id() AND state IN ('draft', 'submitted'));

-- A person may submit and may re-submit after being handed back, and may never
-- approve. approved_by is pinned to the approver so it cannot be forged.
DROP POLICY IF EXISTS tc_submissions_own_update ON tc_submissions;
CREATE POLICY tc_submissions_own_update ON tc_submissions
  FOR UPDATE TO authenticated
  USING (person_id = my_person_id() AND state IN ('draft', 'returned'))
  WITH CHECK (person_id = my_person_id() AND state IN ('draft', 'submitted'));

DROP POLICY IF EXISTS tc_submissions_approver_update ON tc_submissions;
CREATE POLICY tc_submissions_approver_update ON tc_submissions
  FOR UPDATE TO authenticated
  USING (tc_approves_for(person_id) AND state = 'submitted')
  WITH CHECK (tc_approves_for(person_id) AND state IN ('approved', 'returned') AND approved_by = my_person_id());

-- ─── Entries: the approver has to see what they are signing ─────────────────

DROP POLICY IF EXISTS tc_entries_approver_read ON tc_entries;
CREATE POLICY tc_entries_approver_read ON tc_entries
  FOR SELECT TO authenticated
  USING (tc_approves_for(person_id));

-- Replaces 058's version, which pinned the new state to 'open' and so made
-- submitting impossible: a person could edit an open entry forever and never
-- move it on.
DROP POLICY IF EXISTS tc_entries_own_update ON tc_entries;
CREATE POLICY tc_entries_own_update ON tc_entries
  FOR UPDATE TO authenticated
  USING (person_id = my_person_id() AND state = 'open' AND source = 'portal')
  WITH CHECK (person_id = my_person_id() AND state IN ('open', 'submitted') AND source = 'portal');

DROP POLICY IF EXISTS tc_entries_approver_update ON tc_entries;
CREATE POLICY tc_entries_approver_update ON tc_entries
  FOR UPDATE TO authenticated
  USING (tc_approves_for(person_id) AND state = 'submitted')
  WITH CHECK (tc_approves_for(person_id) AND state IN ('approved', 'open'));
