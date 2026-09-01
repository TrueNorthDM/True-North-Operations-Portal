-- 077_drop_tsheets_timesheets.sql
--
-- Drop the old i7 timesheet cache.
--
-- It was the report's source until phase 5 moved the hours to tc_entries. Since
-- then nothing has read it: the client reports read tc_entries, and the only
-- other reader was the probe that compared the two during the swap, which
-- retired with it.
--
-- Nothing is lost. tc_entries holds every entry since 2017 and is never pruned;
-- this table held only the i7 branch, on a rolling 24 month window with a floor
-- of January 2026, keyed by the TSheets account rather than by the person. It
-- is a strict subset, and QuickBooks Time still has the originals.
--
-- Dropped rather than left unfed. An unfed table is worse than a missing one:
-- it keeps answering, with 2026 numbers, to anyone who finds it later and
-- assumes a table that exists is a table that is current. That is the same
-- shape as the two defects this month, a thing that looks alive and is not.
--
-- The code side shipped first: the timesheet pull is out of the sync, the
-- report's freshness badge reads tc_import_runs (the pipeline it actually
-- reads), and the row is gone from database.types.ts.

BEGIN;

DROP TABLE IF EXISTS tsheets_timesheets;

COMMIT;

-- Should be zero rows.
SELECT count(*) AS still_there
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'tsheets_timesheets';
