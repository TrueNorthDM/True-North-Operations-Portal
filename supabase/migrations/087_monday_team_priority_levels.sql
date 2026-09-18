-- 087_monday_team_priority_levels.sql
--
-- Team priority in three levels: workspace, board, item.
--
-- Asked for and confirmed on 18 September 2026. A team leader (or anyone with
-- team priority on Admin → Access levels) orders whole workspaces, then the
-- boards inside each, then single items:
--   1. workspaces in the team's order, everything in the first before anything
--      in the second, late work included;
--   2. inside each workspace, boards in the team's order;
--   3. inside each board, True North's order (board priority, then the soonest
--      deadline);
--   4. a step placed by hand (084's pinned) keeps its place above all of it.
-- What nobody ordered follows True North, and a workspace or board nobody
-- placed joins the end of its level. With both lists empty the team's list is
-- True North's order exactly as before this migration.
--
-- Two lists, not snapshots of steps: a step that arrives on a board next week
-- takes its board's place with nobody moving it. Workspaces are stored by name,
-- as the portal shows them (boards with none are under 'No workspace'); boards
-- by their Monday id.
--
-- Additive, with empty defaults, so every order saved before it means what it
-- meant. The page and the editor work without it, offering single items only.

BEGIN;

ALTER TABLE monday_team_priority
  ADD COLUMN IF NOT EXISTS workspace_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS board_order JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN monday_team_priority.workspace_order IS
  'Workspace names in the team''s order, first to last. Empty: not set, True North''s order applies.';
COMMENT ON COLUMN monday_team_priority.board_order IS
  'Monday board ids in the team''s order, first to last, each read inside its own workspace. Empty: not set.';

COMMIT;
