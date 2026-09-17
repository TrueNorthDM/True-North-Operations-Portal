-- 086_monday_board_updated_at.sql
--
-- When Monday itself says a board last changed, so a hidden board can come back.
--
-- The stale rule (074) hides a board quiet for six months and brings it back
-- when it is touched again. The second half could never fire: a board's
-- activity is read from its items, the sync only reads boards that are shown,
-- so a hidden board's activity was frozen at the moment it was hidden. Found on
-- 16 September 2026 with the switch already on: 221 boards hidden, none of them
-- read since 8 September, and no way back for any of them. Work assigned on one
-- of those boards would never appear on My Work.
--
-- This column is the way back in. Discovery lists every board in the account at
-- the head of each sync, hidden ones included, and Monday gives each board's own
-- updated_at for free in that same query. A hidden board whose updated_at is
-- newer than the last time we read its items is read once more (boardsToProbe,
-- stale.ts), which stamps its real item activity, and only then does the rule
-- decide whether it comes back.
--
-- Deliberately NOT used as the activity itself. Monday bumps a board's
-- updated_at for changes that are not work, like renaming a column, and
-- trusting it would resurrect a finished board full of year-old open steps,
-- which is the complaint this module has been fixing all week.
--
-- Additive: the sync and the discovery both work without it, and until it is
-- filled no board is read that was not read before.

BEGIN;

ALTER TABLE monday_boards
  ADD COLUMN IF NOT EXISTS board_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN monday_boards.board_updated_at IS
  'Monday''s own updated_at for the board, from discovery. Used only to decide whether a hidden board is worth reading again; a board''s activity is still its items (last_activity_at).';

COMMIT;
