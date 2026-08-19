-- 065_monday_ingest_progress.sql
--
-- Where the assignment ingest got to, per board.
--
-- 197 boards do not fit in one Vercel function: it is killed at 300 seconds.
-- So the ingest takes as many boards as fit in its budget, oldest first, and
-- is run again until nothing is left. Progress has to survive between those
-- runs, and the honest place for "when was this board last read" is the board.
--
-- No run table, no cursor to keep in sync with reality. A slice that dies
-- mid-board costs that one board, which is re-read from scratch next time.
-- The alternative, a separate progress table, is a second copy of the truth
-- and the TSheets import already showed what happens when the two disagree:
-- a stale reconciliation row said a month was wrong for hours while the data
-- underneath it had been right all along.

ALTER TABLE monday_boards
  ADD COLUMN IF NOT EXISTS items_synced_at TIMESTAMPTZ;

-- Oldest first, nulls first: a board never read outranks one read yesterday.
CREATE INDEX IF NOT EXISTS monday_boards_ingest_idx
  ON monday_boards (items_synced_at NULLS FIRST)
  WHERE included;
