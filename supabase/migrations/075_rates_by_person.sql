-- 075_rates_by_person.sql
--
-- A rate belongs to a person, not to a TSheets account.
--
-- tr_assignments has been keyed by tsheets_user_id since it was written, and
-- that worked because everybody who billed hours had a TSheets account. The
-- first contractor who does not, and whose hours are added by hand from an
-- invoice, has no key: no row can be written for them, they cannot appear in
-- Rates & Costs, and their hours would count in the i7 report at a cost of
-- zero, making the budget read as less consumed than it is.
--
-- The column becomes a second key rather than a replacement. Every reader is
-- moved onto person_id, and tsheets_user_id stays for the sync that fills it
-- and for a rate whose person nobody has linked yet. Dropping it here would
-- mean a migration that cannot be rolled back after a bad deploy.

BEGIN;

ALTER TABLE tr_assignments
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE RESTRICT;

COMMENT ON COLUMN tr_assignments.person_id IS
  'Who this rate belongs to. Set for every rate whose TSheets account is linked to a directory person; the source of truth from migration 075 onwards.';

-- Fill it from the link that already exists. A rate whose TSheets account is
-- not linked to anybody keeps a null and is left exactly as it was.
UPDATE tr_assignments a
SET person_id = p.id
FROM people p
WHERE p.tsheets_user_id = a.tsheets_user_id
  AND a.person_id IS NULL;

CREATE INDEX IF NOT EXISTS tr_assignments_person_idx ON tr_assignments (person_id);

COMMIT;

-- How much of the table found its person. unmatched is rates whose TSheets
-- account belongs to nobody in the directory: they keep working through the
-- old key, and are worth a look.
SELECT
  count(*) AS rates,
  count(person_id) AS matched,
  count(*) - count(person_id) AS unmatched
FROM tr_assignments;
