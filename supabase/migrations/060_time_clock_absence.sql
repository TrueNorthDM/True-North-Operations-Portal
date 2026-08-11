-- 060_time_clock_absence.sql
--
-- Phase 4: time off stops being a job code somebody types hours into.
--
-- Today an approved holiday is indistinguishable from work: eight hours against
-- "Vacation", entered by hand, with no request and no record of who agreed to
-- it. The request is the thing worth keeping, and it is what this makes exist.
--
-- BALANCES ARE NOT A GATE. Every one of the 26 active people in the account
-- carries a PTO balance of zero for every type, which is how you can tell
-- nobody maintains them. So the balance table stays readable and admin-written,
-- and no policy here checks a request against it. Refusing time off on a number
-- nobody keeps would break the feature on its first day.
--
-- The transitions follow the same shape as the approvals in 059: USING sees the
-- row as it is, WITH CHECK sees what it would become, and pairing the two says
-- what may happen without ever comparing old to new, which Postgres will not do
-- inside a policy.

-- ─── Requests ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_absence_read ON tc_absence_requests;
CREATE POLICY tc_absence_read ON tc_absence_requests
  FOR SELECT TO authenticated
  USING (person_id = my_person_id() OR tc_approves_for(person_id));

-- Asking is always for yourself, and always starts as a question.
DROP POLICY IF EXISTS tc_absence_own_insert ON tc_absence_requests;
CREATE POLICY tc_absence_own_insert ON tc_absence_requests
  FOR INSERT TO authenticated
  WITH CHECK (person_id = my_person_id() AND state = 'pending');

-- A person may withdraw their own request, whether it is still waiting or
-- already approved: plans change, and cancelling is not the same as deciding.
-- What they may not do is approve it.
DROP POLICY IF EXISTS tc_absence_own_update ON tc_absence_requests;
CREATE POLICY tc_absence_own_update ON tc_absence_requests
  FOR UPDATE TO authenticated
  USING (person_id = my_person_id() AND state IN ('pending', 'approved'))
  WITH CHECK (person_id = my_person_id() AND state IN ('pending', 'cancelled'));

-- The approver decides, and only on what is still open. decided_by is pinned to
-- them so the record cannot name somebody else.
DROP POLICY IF EXISTS tc_absence_approver_update ON tc_absence_requests;
CREATE POLICY tc_absence_approver_update ON tc_absence_requests
  FOR UPDATE TO authenticated
  USING (tc_approves_for(person_id) AND state = 'pending')
  WITH CHECK (tc_approves_for(person_id) AND state IN ('approved', 'denied') AND decided_by = my_person_id());

-- ─── Balances ───────────────────────────────────────────────────────────────
-- Readable by the person and by whoever signs for them, so a number on screen
-- can be talked about. Written by admins only, through 057's policy, because
-- there is no accrual rule to compute one from.

DROP POLICY IF EXISTS tc_absence_balances_read ON tc_absence_balances;
CREATE POLICY tc_absence_balances_read ON tc_absence_balances
  FOR SELECT TO authenticated
  USING (person_id = my_person_id() OR tc_approves_for(person_id));
