-- 083_monday_item_language.sql
--
-- The language of the item a step is on, for the Language column on My Work.
--
-- Five boards carry one page per language as separate items with the same name:
-- AAAF - Publishing, HFA - Publishing, the AAAF and HFA translation subitems, and
-- Swiftype Audits. On My Work their rows were identical, down to the name, the
-- step and the deadline, and read as duplicates: "128 - How do Adventists view
-- the concept of the end of the world?" four times, which was English,
-- Portuguese, Swahili and Spanish.
--
-- Read from the board's own column called "Language" by the sync. Empty on every
-- board that has none. Additive: the sync and the page both work without it and
-- simply show no language until it exists.

BEGIN;

ALTER TABLE monday_assignments
  ADD COLUMN IF NOT EXISTS item_language TEXT;

COMMENT ON COLUMN monday_assignments.item_language IS
  'The item''s value in its board''s "Language" column, as Monday writes it (English, Portuguese...). NULL when the board has no such column or the item has none set.';

COMMIT;
