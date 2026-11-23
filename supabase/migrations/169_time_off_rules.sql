-- Paid time off, by the handbook (Tina, 20 November 2026; owner, 23 November
-- 2026). Two things the portal did not keep:
--
--   people.employee_since   the day a person became an employee, when that is
--                           not their hire date (someone who was a contractor
--                           first). Vacation opens a year after it. Empty:
--                           the hire date counts.
--   tc_time_off_balances    what each US employee has left of Vacation and
--                           sick leave, as Rippling's Time off balances report
--                           said on a day. Finance loads the report (North
--                           Time > Reports > Time off balances); the portal
--                           takes off the time off approved since.
--
-- The balances themselves are loaded on the page, never written here. Read and
-- written by the server only. Safe to run twice.

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS employee_since DATE;
COMMENT ON COLUMN people.employee_since IS 'The day they became an employee, when it is not hire_date (a contractor first). Vacation opens a year after it.';

-- Rock Kai was a contractor until 1 October 2026 (owner, 16 November 2026).
UPDATE people SET employee_since = DATE '2026-10-01'
 WHERE full_name = 'Rock Kai' AND employment_type = 'us' AND employee_since IS NULL;

CREATE TABLE IF NOT EXISTS tc_time_off_balances (
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('vacation', 'sick')),
  hours      NUMERIC(7,2) NOT NULL,
  as_of      DATE NOT NULL,
  loaded_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  loaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, kind)
);

ALTER TABLE tc_time_off_balances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tc_time_off_balances FROM anon, authenticated;

-- The daily check watches the new table too. The check's list differs by
-- database, so the table is added to the function as each database has it.
DO $do$
DECLARE
  def TEXT := pg_get_functiondef('public.db_protections_check()'::regprocedure);
BEGIN
  IF position('''tc_time_off_balances''' IN def) = 0 THEN
    IF position('''portal_sign_in_exceptions''' IN def) = 0 THEN
      RAISE EXCEPTION 'db_protections_check has no portal_sign_in_exceptions to add after: run migration 168 first';
    END IF;
    EXECUTE replace(def, '''portal_sign_in_exceptions''', '''portal_sign_in_exceptions'',''tc_time_off_balances''');
  END IF;
END
$do$;

COMMIT;
