-- 105_my_work_log_cleanup.sql
--
-- Removes change-log events the sync wrote for a setting, not for the work
-- (audit, 10 October 2026, module 9, approved by Arnaldo the same day).
--
-- 1. "Deadline changed" events that changed nothing. When a board's date
--    column changed, discovery emptied the due date of every row on the board
--    until the next read, and the read then logged "due date set" from empty
--    to the date the step already had. Removed: a due_date event from an
--    empty value whose new date equals the date the step's previous event
--    carried. A deadline really removed and set again keeps both its events,
--    since the removal is logged with an empty date.
--
-- 2. "Unassigned" written for a people column that stopped being a step. Before
--    15 September 2026 a column that stopped owning a deadline, or was switched
--    off, logged an "unassigned" for every row at once. Removed: bursts of 50
--    or more in one board and one minute, on a column that is not a step today.
--    The other bursts in the log are kept: their items left the board for good
--    and their columns are still steps, so they read as real removals.
--
-- The rows are copied to a reserve table first, so the clean-up can be undone:
--   INSERT INTO monday_assignment_events SELECT * FROM monday_assignment_events_reserve_105;

BEGIN;

CREATE TABLE IF NOT EXISTS monday_assignment_events_reserve_105
  (LIKE monday_assignment_events INCLUDING DEFAULTS INCLUDING INDEXES);
ALTER TABLE monday_assignment_events_reserve_105 ADD COLUMN IF NOT EXISTS why TEXT;

ALTER TABLE monday_assignment_events_reserve_105 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON monday_assignment_events_reserve_105 FROM anon, authenticated;

WITH ordered AS (
  SELECT e.id, e.event, e.from_value, e.to_value,
         lag(e.due_date) OVER (PARTITION BY e.item_id, e.people_col, e.monday_user_id ORDER BY e.occurred_at, e.id) AS due_before
    FROM monday_assignment_events e
)
INSERT INTO monday_assignment_events_reserve_105
SELECT e.*, 'due date set to the date it already had'
  FROM monday_assignment_events e JOIN ordered o USING (id)
 WHERE o.event = 'due_date' AND o.from_value IS NULL
   AND o.due_before IS NOT NULL AND o.to_value = o.due_before::text
ON CONFLICT DO NOTHING;

WITH bursts AS (
  SELECT board_id, people_col, date_trunc('minute', detected_at) AS m
    FROM monday_assignment_events
   WHERE event = 'unassigned'
   GROUP BY 1, 2, 3
  HAVING count(*) >= 50
),
not_steps AS (
  SELECT board_id, people_col FROM monday_board_steps
   WHERE source = 'off'
      OR (jsonb_typeof(stages) = 'array' AND jsonb_array_length(stages) = 0)
)
INSERT INTO monday_assignment_events_reserve_105
SELECT e.*, 'unassigned when the column stopped being a step'
  FROM monday_assignment_events e
  JOIN bursts b ON b.board_id = e.board_id AND b.people_col = e.people_col AND b.m = date_trunc('minute', e.detected_at)
  JOIN not_steps s ON s.board_id = e.board_id AND s.people_col = e.people_col
 WHERE e.event = 'unassigned'
ON CONFLICT DO NOTHING;

DELETE FROM monday_assignment_events e
 USING monday_assignment_events_reserve_105 r
 WHERE e.id = r.id;

COMMIT;
