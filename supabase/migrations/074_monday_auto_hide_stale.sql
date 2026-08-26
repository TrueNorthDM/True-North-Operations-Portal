-- 074_monday_auto_hide_stale.sql
--
-- A standing rule: a board's visibility follows its activity.
--
--   quiet for six months  ->  hidden
--   touched again         ->  back
--
-- 262 boards is more than anybody works on, and the ones that make My Work
-- longer without making it truer are almost always finished projects. They do
-- not announce themselves; they go quiet. And a project that restarts does not
-- announce itself either, which is why the rule runs both ways: a board that
-- comes back to life bringing its work with it should not need somebody to
-- remember it exists.
--
-- included_pinned is the escape hatch. Some boards are hidden for reasons that
-- have nothing to do with activity: a personal space, an experiment, a board
-- that duplicates another. Pinning one takes it out of the rule's hands for
-- good, in whichever state it was left.
--
-- ONE RULE COVERS WHAT LOOKS LIKE TWO. A workspace has no row of its own here,
-- its state is the state of its boards, and its activity is the most recent of
-- them. So a workspace quiet for six months is exactly a workspace whose every
-- board is quiet, and hiding the boards hides the workspace.
--
-- NOTHING IS PINNED BY THIS MIGRATION, deliberately. Boards hidden before the
-- rule existed were hidden by hand, but pinning them would mean a board that
-- has come back into use never returns, which is the half of the rule that was
-- asked for second and matters more. The query at the end says exactly what
-- turning the switch on would do, in both directions, before anybody does it.

BEGIN;

ALTER TABLE monday_boards
  ADD COLUMN IF NOT EXISTS included_pinned BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN monday_boards.included_pinned IS
  'Somebody decided this board''s visibility for a reason other than activity. The stale rule leaves it alone in whichever state it was left.';

CREATE INDEX IF NOT EXISTS monday_boards_stale_idx
  ON monday_boards (last_activity_at) WHERE included_pinned = false;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS monday_hide_stale_boards BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN app_settings.monday_hide_stale_boards IS
  'When true, a board is shown while it has had Monday activity in the last six months and hidden when it has not, unless it is pinned.';

COMMIT;

-- What the switch would do today. Check both numbers before turning it on:
-- would_show is the surprising one.
SELECT
  count(*) FILTER (
    WHERE included AND NOT included_pinned
      AND (last_activity_at IS NULL OR last_activity_at < now() - interval '6 months')
  ) AS would_hide,
  count(*) FILTER (
    WHERE NOT included AND NOT included_pinned
      AND last_activity_at >= now() - interval '6 months'
  ) AS would_show,
  count(*) FILTER (WHERE included) AS shown_now,
  count(*) AS boards
FROM monday_boards;
