-- 067_monday_dates_and_colours.sql
--
-- A deadline column on the work list, and status chips in Monday's own colours.
--
-- COLOURS. A status column's settings_str already carries labels_colors: index
-- → the exact hex Monday paints that label with. The same file is where
-- done_colors comes from, so this is a second use of something already read.
-- Re-inventing a palette here would mean a step that is amber in Monday shows
-- up grey in the portal, and then people stop trusting that the two agree.
--
-- DATES. There is no such thing as "the" date column: a board can have several,
-- or none. Discovery picks one per board and records which, so the choice is
-- visible and correctable rather than a rule buried in code that has to be
-- re-derived every time somebody wonders where a date came from.

BEGIN;

ALTER TABLE monday_boards
  -- Which column this board's deadline comes from, chosen at discovery.
  ADD COLUMN IF NOT EXISTS date_col   TEXT,
  ADD COLUMN IF NOT EXISTS date_title TEXT;

ALTER TABLE monday_assignments
  ADD COLUMN IF NOT EXISTS due_date     DATE,
  -- Monday's hex for this label, copied at read time. Stored rather than looked
  -- up per render: the page would otherwise need every board's settings just to
  -- paint a chip.
  ADD COLUMN IF NOT EXISTS status_color TEXT;

-- What is due soonest, among what is still open.
CREATE INDEX IF NOT EXISTS monday_assignments_due_idx
  ON monday_assignments (due_date)
  WHERE status_done IS NOT TRUE;

COMMIT;
