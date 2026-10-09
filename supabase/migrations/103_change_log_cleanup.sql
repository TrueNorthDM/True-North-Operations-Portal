-- 103_change_log_cleanup.sql
--
-- Removes the false "assigned right after done" events from the change log
-- (audit, 9 October 2026, module 8, approved by Arnaldo the same day).
--
-- Until 30 September 2026 the read of a large Monday board stopped at 1,000
-- rows, a bug since fixed. Items past that point looked new on each read, and
-- the log wrote "this step was assigned to them" again although nothing had
-- changed. After a "done", that false hand-off cancelled the delivery in the
-- Report: the step looked as if it had come back to the person.
--
-- What is removed, and only that:
--   - an "assigned" event,
--   - detected between 21 August and 30 September 2026 (the bug's lifetime),
--   - whose event just before it, for the same item, step and person, is a
--     "done",
--   - and which itself still says the step is done (status_done true): there
--     was no real status change between the two, so nothing came back.
-- Production had 572 such rows when this was written, none after 30 September.
--
-- Repeated "assigned" while the step is already held are not removed: the
-- Report ignores them (lib/report/spans.ts).
--
-- The rows are copied to a reserve table first, so the clean-up can be undone:
--   INSERT INTO monday_assignment_events SELECT * FROM monday_assignment_events_reserve_103;

BEGIN;

CREATE TABLE IF NOT EXISTS monday_assignment_events_reserve_103
  (LIKE monday_assignment_events INCLUDING DEFAULTS INCLUDING INDEXES);

ALTER TABLE monday_assignment_events_reserve_103 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON monday_assignment_events_reserve_103 FROM anon, authenticated;

WITH ordered AS (
  SELECT id, event, status_done, detected_at,
         lag(event) OVER (PARTITION BY item_id, people_col, monday_user_id ORDER BY occurred_at, id) AS before
    FROM monday_assignment_events
),
false_handoffs AS (
  SELECT id FROM ordered
   WHERE event = 'assigned'
     AND before = 'done'
     AND status_done IS TRUE
     AND detected_at >= '2026-08-21' AND detected_at < '2026-10-01'
)
INSERT INTO monday_assignment_events_reserve_103
SELECT e.* FROM monday_assignment_events e JOIN false_handoffs f USING (id)
ON CONFLICT DO NOTHING;

DELETE FROM monday_assignment_events e
 USING monday_assignment_events_reserve_103 r
 WHERE e.id = r.id;

COMMIT;
