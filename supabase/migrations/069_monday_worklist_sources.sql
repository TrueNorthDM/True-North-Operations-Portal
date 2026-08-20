-- 069_monday_worklist_sources.sql
--
-- Choosing what My Work is allowed to show.
--
-- 262 boards across 20 workspaces, and a good number of them are finished
-- projects, experiments or somebody's personal space. Their steps are real and
-- they are also never going to be done, so they sit on the list forever making
-- it longer without making it truer.
--
-- monday_boards.included has existed since the first migration for exactly
-- this; what was missing is a way to decide it. Two of the three pieces are
-- facts nobody can supply from memory: when a board was last touched, and how
-- much work is on it. Both are known during the ingest, so they are recorded
-- there rather than computed by a settings page scanning 53,000 rows.

BEGIN;

ALTER TABLE monday_boards
  -- The most recent change to any item on this board, which is the honest
  -- answer to "have we used this lately".
  ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assignments_count  INT;

ALTER TABLE monday_users
  -- Kept out of My Work by choice. Distinct from is_external, which says the
  -- account belongs to somebody outside True North: a person can be ours,
  -- linked, and still not belong on this page.
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN monday_users.hidden IS
  'Excluded from My Work on purpose. Their assignments are still ingested and still counted; they simply do not appear on the page.';

COMMIT;
