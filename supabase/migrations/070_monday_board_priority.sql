-- 070_monday_board_priority.sql
--
-- How much a board matters, said by a person rather than inferred.
--
-- Nothing in Monday knows this. Assignment counts say how BUSY a board is and
-- deadlines say what is URGENT, and neither is the same as important: the board
-- with the most rows is often routine, and a quiet one can be the quarter's
-- whole point. That judgement only exists in somebody's head, so there is a
-- field for it.
--
-- Set on the board because that is the grain the work already has here. Every
-- assignment belongs to exactly one board, so every row inherits a priority
-- without anybody tagging 53,000 of them.
--
-- Medium by default, deliberately. Defaulting to high would make the word
-- meaningless on day one, and defaulting to low would bury everything until
-- somebody had been through 262 boards.

BEGIN;

ALTER TABLE monday_boards
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low'));

COMMENT ON COLUMN monday_boards.priority IS
  'How much this board matters, set by an admin in Settings. Orders the On-going block of My Work; does not affect what is ingested or shown.';

COMMIT;
