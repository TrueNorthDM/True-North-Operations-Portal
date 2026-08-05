-- 058_time_clock_own_entries.sql
--
-- Phase 2 opens exactly what the clock needs and nothing else.
--
-- 057 closed every tc_ table to admins on purpose, so that each phase would
-- have to argue for what it opens. The clock needs two things: everyone must be
-- able to READ the catalogue (job codes and the dropdown values are the entry
-- form), and everyone must be able to write THEIR OWN entries.
--
-- "Their own" is a row-level question, which is what RLS is actually for. It is
-- enforced here rather than in the server actions, because an action is one
-- code path among many and a policy is the floor under all of them.
--
-- Not opened here, deliberately: reading somebody else's hours (phase 3, the
-- approver), and editing an entry that has already been submitted or approved.
-- The second is not a nicety. Once a timesheet is submitted it is a claim
-- somebody acted on, and silently rewriting it is the failure mode a time
-- system has to make impossible.

-- ─── Who am I ───────────────────────────────────────────────────────────────

-- The directory person behind the signed-in account. STABLE so Postgres calls
-- it once per statement instead of once per row.
CREATE OR REPLACE FUNCTION my_person_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM people WHERE profile_id = auth.uid() LIMIT 1
$$;

-- ─── The catalogue is readable by everyone signed in ────────────────────────
-- These are lists of job codes and dropdown values. They carry no hours, no
-- money and no personal data, and without them nobody can fill in a timesheet.

DROP POLICY IF EXISTS tc_jobcodes_read ON tc_jobcodes;
CREATE POLICY tc_jobcodes_read ON tc_jobcodes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tc_fields_read ON tc_fields;
CREATE POLICY tc_fields_read ON tc_fields
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tc_field_options_read ON tc_field_options;
CREATE POLICY tc_field_options_read ON tc_field_options
  FOR SELECT TO authenticated USING (true);

-- The rules (timezone, rounding, pay period) shape what the clock shows, so the
-- clock has to read them. Writing them stays with admins, through 057's policy.
DROP POLICY IF EXISTS tc_settings_read ON tc_settings;
CREATE POLICY tc_settings_read ON tc_settings
  FOR SELECT TO authenticated USING (true);

-- ─── A person's own entries ─────────────────────────────────────────────────

DROP POLICY IF EXISTS tc_entries_own_read ON tc_entries;
CREATE POLICY tc_entries_own_read ON tc_entries
  FOR SELECT TO authenticated
  USING (person_id = my_person_id());

-- WITH CHECK on the insert covers what the row is allowed to claim on the way
-- in: your own person, and never born already approved.
DROP POLICY IF EXISTS tc_entries_own_insert ON tc_entries;
CREATE POLICY tc_entries_own_insert ON tc_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    person_id = my_person_id()
    AND state = 'open'
    AND source = 'portal'
  );

-- USING decides which rows may be edited, WITH CHECK what they may become.
-- Both are needed: without the second, an open entry could be edited into an
-- approved one, which is the same as approving your own timesheet.
DROP POLICY IF EXISTS tc_entries_own_update ON tc_entries;
CREATE POLICY tc_entries_own_update ON tc_entries
  FOR UPDATE TO authenticated
  USING (person_id = my_person_id() AND state = 'open' AND source = 'portal')
  WITH CHECK (person_id = my_person_id() AND state = 'open' AND source = 'portal');

DROP POLICY IF EXISTS tc_entries_own_delete ON tc_entries;
CREATE POLICY tc_entries_own_delete ON tc_entries
  FOR DELETE TO authenticated
  USING (person_id = my_person_id() AND state = 'open' AND source = 'portal');

-- ─── Audit ──────────────────────────────────────────────────────────────────
-- Append-only from the app: anyone may add a line about their own change, and
-- nobody but an admin may read the trail or alter it. A log a user can edit is
-- not a log.

DROP POLICY IF EXISTS tc_entry_audit_insert ON tc_entry_audit;
CREATE POLICY tc_entry_audit_insert ON tc_entry_audit
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = my_person_id());
