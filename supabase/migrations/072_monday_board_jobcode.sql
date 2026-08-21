-- 072_monday_board_jobcode.sql
--
-- Which timeclock project a Monday board's work is booked to.
--
-- The Workload tab estimates how many hours a step takes: hours logged over
-- steps delivered. Today no board is linked to a project code, so there is
-- nothing to divide per board and every board shares one global average. The
-- estimate audit says "fallback" for all of them, which is honest and also
-- not very useful: a translation step and a monthly report step do not take
-- the same time, and one average tells a lead neither.
--
-- One nullable column, because the mapping is partial by nature. Most boards
-- will never have a code of their own, and those keep falling back. A board
-- that gets one starts being measured, and the audit says so.

ALTER TABLE monday_boards
  ADD COLUMN IF NOT EXISTS tc_jobcode_id INTEGER REFERENCES tc_jobcodes(id) ON DELETE SET NULL;

COMMENT ON COLUMN monday_boards.tc_jobcode_id IS
  'Timeclock project this board''s hours are booked to. NULL means the effort estimate falls back to the global average.';

-- Read when the Workload tab groups hours by board.
CREATE INDEX IF NOT EXISTS monday_boards_jobcode_idx
  ON monday_boards (tc_jobcode_id) WHERE tc_jobcode_id IS NOT NULL;
