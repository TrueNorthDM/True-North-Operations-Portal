-- 061_time_clock_policy_speed.sql
--
-- The Grant Pass report timed out: "canceling statement due to statement
-- timeout" for a signed-in user, against 187ms for the service role. Same
-- query, same rows. The difference was entirely row level security.
--
-- WHY. A policy expression is evaluated per row. tc_approves_for(person_id)
-- runs two EXISTS subqueries, so a query touching a large part of tc_entries
-- ran them a hundred thousand times. The i7 report never noticed because it
-- asks for one month; Grant Pass asks across nine years.
--
-- THE FIX. Two rewrites, both standard and both about WHEN an expression is
-- evaluated rather than what it says:
--
--   my_person_id()          ->  (SELECT my_person_id())
--   tc_approves_for(col)    ->  col IN (SELECT tc_people_i_approve())
--
-- A scalar subquery with no reference to the row is hoisted into an InitPlan
-- and run once for the whole statement. Turning "does this person report to me"
-- into "is this person in the set of people who report to me" moves the work
-- out of the row loop, because the set does not depend on the row.
--
-- Nothing about who can see what changes. Every policy below permits exactly
-- what it permitted before.

-- ─── The set, rather than a question asked per row ──────────────────────────

CREATE OR REPLACE FUNCTION tc_people_i_approve()
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM people p WHERE p.manager_id = my_person_id()
  UNION
  SELECT tm.person_id
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE t.leader_person_id = my_person_id()
$$;

-- ─── Entries ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_entries_own_read ON tc_entries;
CREATE POLICY tc_entries_own_read ON tc_entries
  FOR SELECT TO authenticated
  USING (person_id = (SELECT my_person_id()));

DROP POLICY IF EXISTS tc_entries_approver_read ON tc_entries;
CREATE POLICY tc_entries_approver_read ON tc_entries
  FOR SELECT TO authenticated
  USING (person_id IN (SELECT tc_people_i_approve()));

DROP POLICY IF EXISTS tc_entries_own_insert ON tc_entries;
CREATE POLICY tc_entries_own_insert ON tc_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    person_id = (SELECT my_person_id())
    AND state = 'open'
    AND source = 'portal'
  );

DROP POLICY IF EXISTS tc_entries_own_update ON tc_entries;
CREATE POLICY tc_entries_own_update ON tc_entries
  FOR UPDATE TO authenticated
  USING (person_id = (SELECT my_person_id()) AND state = 'open' AND source = 'portal')
  WITH CHECK (person_id = (SELECT my_person_id()) AND state IN ('open', 'submitted') AND source = 'portal');

DROP POLICY IF EXISTS tc_entries_approver_update ON tc_entries;
CREATE POLICY tc_entries_approver_update ON tc_entries
  FOR UPDATE TO authenticated
  USING (person_id IN (SELECT tc_people_i_approve()) AND state = 'submitted')
  WITH CHECK (person_id IN (SELECT tc_people_i_approve()) AND state IN ('approved', 'open'));

DROP POLICY IF EXISTS tc_entries_own_delete ON tc_entries;
CREATE POLICY tc_entries_own_delete ON tc_entries
  FOR DELETE TO authenticated
  USING (person_id = (SELECT my_person_id()) AND state = 'open' AND source = 'portal');

-- ─── Submissions ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_submissions_read ON tc_submissions;
CREATE POLICY tc_submissions_read ON tc_submissions
  FOR SELECT TO authenticated
  USING (person_id = (SELECT my_person_id()) OR person_id IN (SELECT tc_people_i_approve()));

DROP POLICY IF EXISTS tc_submissions_own_insert ON tc_submissions;
CREATE POLICY tc_submissions_own_insert ON tc_submissions
  FOR INSERT TO authenticated
  WITH CHECK (person_id = (SELECT my_person_id()) AND state IN ('draft', 'submitted'));

DROP POLICY IF EXISTS tc_submissions_own_update ON tc_submissions;
CREATE POLICY tc_submissions_own_update ON tc_submissions
  FOR UPDATE TO authenticated
  USING (person_id = (SELECT my_person_id()) AND state IN ('draft', 'returned'))
  WITH CHECK (person_id = (SELECT my_person_id()) AND state IN ('draft', 'submitted'));

DROP POLICY IF EXISTS tc_submissions_approver_update ON tc_submissions;
CREATE POLICY tc_submissions_approver_update ON tc_submissions
  FOR UPDATE TO authenticated
  USING (person_id IN (SELECT tc_people_i_approve()) AND state = 'submitted')
  WITH CHECK (
    person_id IN (SELECT tc_people_i_approve())
    AND state IN ('approved', 'returned')
    AND approved_by = (SELECT my_person_id())
  );

-- ─── Time off ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_absence_read ON tc_absence_requests;
CREATE POLICY tc_absence_read ON tc_absence_requests
  FOR SELECT TO authenticated
  USING (person_id = (SELECT my_person_id()) OR person_id IN (SELECT tc_people_i_approve()));

DROP POLICY IF EXISTS tc_absence_own_insert ON tc_absence_requests;
CREATE POLICY tc_absence_own_insert ON tc_absence_requests
  FOR INSERT TO authenticated
  WITH CHECK (person_id = (SELECT my_person_id()) AND state = 'pending');

DROP POLICY IF EXISTS tc_absence_own_update ON tc_absence_requests;
CREATE POLICY tc_absence_own_update ON tc_absence_requests
  FOR UPDATE TO authenticated
  USING (person_id = (SELECT my_person_id()) AND state IN ('pending', 'approved'))
  WITH CHECK (person_id = (SELECT my_person_id()) AND state IN ('pending', 'cancelled'));

DROP POLICY IF EXISTS tc_absence_approver_update ON tc_absence_requests;
CREATE POLICY tc_absence_approver_update ON tc_absence_requests
  FOR UPDATE TO authenticated
  USING (person_id IN (SELECT tc_people_i_approve()) AND state = 'pending')
  WITH CHECK (
    person_id IN (SELECT tc_people_i_approve())
    AND state IN ('approved', 'denied')
    AND decided_by = (SELECT my_person_id())
  );

DROP POLICY IF EXISTS tc_absence_balances_read ON tc_absence_balances;
CREATE POLICY tc_absence_balances_read ON tc_absence_balances
  FOR SELECT TO authenticated
  USING (person_id = (SELECT my_person_id()) OR person_id IN (SELECT tc_people_i_approve()));

-- ─── Audit ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_entry_audit_insert ON tc_entry_audit;
CREATE POLICY tc_entry_audit_insert ON tc_entry_audit
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = (SELECT my_person_id()));

-- ─── The admin blanket, same treatment ──────────────────────────────────────
-- is_admin(auth.uid()) was also being asked per row on every tc_ table.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tc_settings','tc_jobcodes','tc_fields','tc_field_options','tc_entries',
    'tc_entry_audit','tc_periods','tc_submissions','tc_absence_requests',
    'tc_absence_balances','tc_import_runs','tc_reconciliation'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())))',
      t || '_admin_all', t
    );
  END LOOP;
END $$;
