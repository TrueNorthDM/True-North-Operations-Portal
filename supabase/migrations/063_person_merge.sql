-- 063_person_merge.sql
--
-- Merging two people, and letting one person own more than one TSheets account.
--
-- WHY BOTH AT ONCE. The directory has 15 pairs of the same human: a row someone
-- typed (email, job title) and a row the hours import created because it could
-- not find anyone carrying that TSheets user id. Twelve are a simple double
-- entry. Three are not: Ashery Lwimbo, David Sharpe and Joyner Buhatwa each
-- have TWO TSheets accounts, an old one and a current one, and both accounts
-- have hours under them.
--
-- people.tsheets_user_id is a single UNIQUE column, so it cannot express that.
-- Merging those three without somewhere to put the second account would drop it,
-- and the very next full import would recreate the duplicate, because the import
-- recognises a person only by an id it can find. tc_user_links is that place:
-- many accounts, one person. people.tsheets_user_id stays as the primary account
-- and every report that reads it keeps working untouched.
--
-- WHAT MERGING MEANS HERE. Everything that points at the loser is moved to the
-- winner and the loser row is deleted. The loser's own attributes are NOT
-- copied: this is for a duplicate whose columns are empty, not for reconciling
-- two filled-in records. The audit table keeps what was moved.
--
-- The two traps this function exists to avoid:
--   1. grants.subject_id has NO foreign key (it points at teams or people
--      depending on subject_type), so nothing moves or deletes it for you. A
--      plain delete leaves a grant pointing at somebody who no longer exists.
--   2. people.tsheets_user_id is UNIQUE, so the loser has to let go of an id
--      before the winner can take it. Order, not cleverness.

BEGIN;

-- ── Many TSheets accounts, one person ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_user_links (
  tsheets_user_id INT PRIMARY KEY,
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  -- The account whose id lives on people.tsheets_user_id, which is what rates,
  -- the i7 report and the name maps are keyed by. Exactly one per person.
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tc_user_links_person_idx ON tc_user_links (person_id);
CREATE UNIQUE INDEX IF NOT EXISTS tc_user_links_one_primary
  ON tc_user_links (person_id) WHERE is_primary;

-- Seed from what the directory already knows. Idempotent.
INSERT INTO tc_user_links (tsheets_user_id, person_id, is_primary)
SELECT tsheets_user_id, id, true
FROM people
WHERE tsheets_user_id IS NOT NULL
ON CONFLICT (tsheets_user_id) DO NOTHING;

ALTER TABLE tc_user_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tc_user_links_read ON tc_user_links;
CREATE POLICY tc_user_links_read ON tc_user_links
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tc_user_links_admin_write ON tc_user_links;
CREATE POLICY tc_user_links_admin_write ON tc_user_links
  FOR ALL TO authenticated
  USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())));

-- ── What a merge destroyed, kept ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS people_merges (
  id           SERIAL PRIMARY KEY,
  winner_id    UUID NOT NULL REFERENCES people(id) ON DELETE SET NULL,
  loser_id     UUID NOT NULL,          -- deliberately not a FK: the row is gone
  loser_name   TEXT NOT NULL,
  loser_tsheets_user_id INT,
  moved        JSONB NOT NULL,
  merged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE people_merges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS people_merges_admin ON people_merges;
CREATE POLICY people_merges_admin ON people_merges
  FOR ALL TO authenticated
  USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())));

-- ── The merge ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION merge_people(winner UUID, loser UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved       JSONB := '{}'::jsonb;
  n           INT;
  loser_name  TEXT;
  loser_tsid  INT;
BEGIN
  -- Called with a JWT: admins only. Called with none (SQL editor, service
  -- role) it proceeds, which is why EXECUTE is revoked from anon below.
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'merge_people: admin only';
  END IF;

  IF winner = loser THEN
    RAISE EXCEPTION 'merge_people: winner and loser are the same row';
  END IF;

  SELECT full_name, tsheets_user_id INTO loser_name, loser_tsid
  FROM people WHERE id = loser;
  IF NOT FOUND THEN RAISE EXCEPTION 'merge_people: loser % not found', loser; END IF;
  PERFORM 1 FROM people WHERE id = winner;
  IF NOT FOUND THEN RAISE EXCEPTION 'merge_people: winner % not found', winner; END IF;

  -- Hours. This is the one that would have blocked a plain delete.
  UPDATE tc_entries SET person_id = winner WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('tc_entries', n);

  UPDATE tc_entries    SET created_by = winner WHERE created_by = loser;
  UPDATE tc_entry_audit SET changed_by = winner WHERE changed_by = loser;

  -- Submissions, UNIQUE (person_id, period_id): the winner's own row wins the
  -- period, the loser's copy of that same period is dropped rather than
  -- colliding.
  DELETE FROM tc_submissions l
   WHERE l.person_id = loser
     AND EXISTS (SELECT 1 FROM tc_submissions w
                  WHERE w.person_id = winner AND w.period_id = l.period_id);
  UPDATE tc_submissions SET person_id = winner WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('tc_submissions', n);
  UPDATE tc_submissions SET approved_by = winner WHERE approved_by = loser;

  UPDATE tc_absence_requests SET person_id = winner WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('tc_absence_requests', n);
  UPDATE tc_absence_requests SET decided_by = winner WHERE decided_by = loser;

  -- Balances, UNIQUE (person_id, jobcode_id, year).
  DELETE FROM tc_absence_balances l
   WHERE l.person_id = loser
     AND EXISTS (SELECT 1 FROM tc_absence_balances w
                  WHERE w.person_id = winner AND w.jobcode_id IS NOT DISTINCT FROM l.jobcode_id
                    AND w.year = l.year);
  UPDATE tc_absence_balances SET person_id = winner WHERE person_id = loser;

  -- Teams, PRIMARY KEY (team_id, person_id).
  DELETE FROM team_members l
   WHERE l.person_id = loser
     AND EXISTS (SELECT 1 FROM team_members w
                  WHERE w.person_id = winner AND w.team_id = l.team_id);
  UPDATE team_members SET person_id = winner WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('team_members', n);
  UPDATE teams SET leader_person_id = winner WHERE leader_person_id = loser;

  -- Grants. No foreign key, so this is the line that keeps an access rule from
  -- outliving the person it was written for. UNIQUE (subject_type, subject_id,
  -- project_id), so a project both rows already had is deduped first.
  DELETE FROM grants l
   WHERE l.subject_type = 'person' AND l.subject_id = loser
     AND EXISTS (SELECT 1 FROM grants w
                  WHERE w.subject_type = 'person' AND w.subject_id = winner
                    AND w.project_id = l.project_id);
  UPDATE grants SET subject_id = winner
   WHERE subject_type = 'person' AND subject_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('grants', n);

  UPDATE person_attachments SET person_id = winner WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('person_attachments', n);
  UPDATE access_log SET person_id = winner WHERE person_id = loser;

  -- Reporting lines pointing at the loser.
  UPDATE people SET manager_id        = winner WHERE manager_id        = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('reports', n);
  UPDATE people SET also_reports_to_id = winner WHERE also_reports_to_id = loser;
  -- If the winner reported to the loser, it now reports to itself. Cut it.
  UPDATE people SET manager_id = NULL         WHERE id = winner AND manager_id = winner;
  UPDATE people SET also_reports_to_id = NULL WHERE id = winner AND also_reports_to_id = winner;

  -- TSheets accounts. The loser's move over as secondary; the winner's own
  -- primary is left alone.
  UPDATE tc_user_links SET person_id = winner, is_primary = false WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('tsheets_accounts', n);

  -- Release the unique id BEFORE the winner can take it.
  UPDATE people SET tsheets_user_id = NULL WHERE id = loser;

  -- A winner who had no account of its own adopts one, so rates and the i7
  -- report keep finding it.
  IF NOT EXISTS (SELECT 1 FROM tc_user_links WHERE person_id = winner AND is_primary) THEN
    UPDATE tc_user_links SET is_primary = true
     WHERE tsheets_user_id = (SELECT min(tsheets_user_id) FROM tc_user_links WHERE person_id = winner);
    UPDATE people SET tsheets_user_id =
      (SELECT tsheets_user_id FROM tc_user_links WHERE person_id = winner AND is_primary)
     WHERE id = winner;
  END IF;

  -- A merged person is in the directory by definition.
  UPDATE people SET tsheets_only = false WHERE id = winner;

  INSERT INTO people_merges (winner_id, loser_id, loser_name, loser_tsheets_user_id, moved)
  VALUES (winner, loser, loser_name, loser_tsid, moved);

  DELETE FROM people WHERE id = loser;

  RETURN moved;
END $$;

REVOKE ALL ON FUNCTION merge_people(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION merge_people(UUID, UUID) TO authenticated;

COMMIT;
