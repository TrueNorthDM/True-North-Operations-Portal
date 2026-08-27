-- 076_rates_tsheets_optional.sql
--
-- A rate no longer needs a TSheets account.
--
-- Migration 075 moved the key to person_id and every reader with it, but left
-- tsheets_user_id NOT NULL. So a rate for somebody outside QuickBooks Time is
-- rejected by the database: the form saves, the row never lands, and the field
-- comes back empty with nothing on screen saying why. That is this exact case,
-- Jonatas, which is the reason any of this was built.
--
-- The column stays, because the sync writes it and it is how a rate is matched
-- back to an account. It is simply no longer required, which is what it always
-- meant: "the TSheets account, if there is one".

BEGIN;

ALTER TABLE tr_assignments ALTER COLUMN tsheets_user_id DROP NOT NULL;

COMMENT ON COLUMN tr_assignments.tsheets_user_id IS
  'The person''s TSheets account, when they have one. Null for somebody whose hours are added by hand. person_id is the key.';

-- Every rate must belong to somebody, whichever way it arrived. Without this,
-- dropping the NOT NULL above would allow a row with neither key: a rate
-- attached to nobody, which no reader would ever apply and nothing would flag.
ALTER TABLE tr_assignments
  DROP CONSTRAINT IF EXISTS tr_assignments_has_owner;
ALTER TABLE tr_assignments
  ADD CONSTRAINT tr_assignments_has_owner
  CHECK (person_id IS NOT NULL OR tsheets_user_id IS NOT NULL);

COMMIT;

SELECT
  count(*) AS rates,
  count(person_id) AS with_person,
  count(tsheets_user_id) AS with_tsheets
FROM tr_assignments;
