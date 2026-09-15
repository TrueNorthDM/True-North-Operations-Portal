-- 082_monday_steps_by_deadline.sql
--
-- A My Work step is a stage of work with a deadline.
--
-- Until now a step was a people column paired with the status column to its
-- right, and every row shared the board's one deadline column. Two things
-- people reported came straight out of that:
--
--   * Statuses with no deadline beside them became steps: Design Needs, Kick-Off,
--     the photo curation "Assign" column. Kick-Off on BM - General Audits has no
--     label that can ever be done, so 127 rows sat open and 116 read as late.
--   * One date per item was stamped on every owner of the item, so a step already
--     delivered showed as late because somebody later in the workflow was.
--
-- So each people column now records the stages it owns: the status to finish and
-- the date to finish it by, read from the board's layout (Monday's API does not
-- return Deadline Mode's link between the two). The rule lives in
-- src/lib/monday/worklist/steps.ts.
--
-- Additive, and safe to run before or after the code that uses it: a NULL
-- stages value means "seeded before this existed", and both readers fall back to
-- the old pairing for those rows until discovery writes the new one.

BEGIN;

ALTER TABLE monday_board_steps
  ADD COLUMN IF NOT EXISTS stages JSONB;

COMMENT ON COLUMN monday_board_steps.stages IS
  'Stages this people column owns, in board order: [{statusCol, statusTitle, dateCol, dateTitle}]. An empty array means the column is not a step (it owns no status with a deadline). NULL means the row was seeded before stages existed, and readers fall back to status_col and the board''s date column.';

-- Which date column a row's due_date came from.
--
-- Needed for two reasons. The page names the deadline ("Review by", not the
-- board's "Audit By"). And the change log has to tell a step whose deadline
-- moved from a step whose deadline is now read from a different column: without
-- it, the first sync under the new rule would record thousands of deadline and
-- status changes that never happened, and the Report reads those as history.
ALTER TABLE monday_assignments
  ADD COLUMN IF NOT EXISTS due_col TEXT;

COMMENT ON COLUMN monday_assignments.due_col IS
  'The date column due_date was read from. NULL on rows written before steps had deadlines of their own, when it was the board''s single date column.';

COMMIT;
