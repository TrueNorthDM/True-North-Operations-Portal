-- 123_person_hidden_columns.sql
--
-- Which table columns each person hides (owner, 25 October 2026): on Rates &
-- Costs and on every table of the Directory, each person chooses the columns
-- they see, kept in their account so the same columns show on any computer or
-- phone.
--
--   hidden_columns  by table, the column keys that person hides, e.g.
--                   {"rates": ["joined", "beRate"], "directory-people": []}.
--                   A table with no entry shows its default columns; an
--                   entry, even an empty list, is the person's own choice.
--                   Each table's identity column is never hidden, whatever is
--                   stored (src/lib/settings/columns.ts).
--
-- Same access as 092 and 093: the server reads and writes with the service
-- role for the person it identified; nothing changes for the signed-in role.
-- Safe to run more than once.

BEGIN;

ALTER TABLE person_settings
  ADD COLUMN IF NOT EXISTS hidden_columns JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_settings_hidden_columns_object') THEN
    ALTER TABLE person_settings
      ADD CONSTRAINT person_settings_hidden_columns_object CHECK (jsonb_typeof(hidden_columns) = 'object');
  END IF;
END $$;

COMMIT;
