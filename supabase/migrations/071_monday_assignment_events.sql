-- 071_monday_assignment_events.sql
--
-- What changed, which the assignments table cannot say.
--
-- monday_assignments is deleted and re-inserted board by board on every sync,
-- so it holds the present and nothing else. Two of the questions the Report
-- exists to answer are about the past:
--
--   how long did this step sit with this person before it was done
--   how much of what shipped met its due date
--
-- Neither can be recovered later. Every sync that runs without this table is
-- history gone for good, six times a day, which is why it lands before any of
-- the screens that read it.
--
-- The ingest already knows the difference: it holds the rows it is about to
-- replace and the rows replacing them. This is that diff, written down.

BEGIN;

CREATE TABLE IF NOT EXISTS monday_assignment_events (
  id             BIGSERIAL PRIMARY KEY,
  board_id       BIGINT      NOT NULL,
  item_id        BIGINT      NOT NULL,
  people_col     TEXT        NOT NULL,
  monday_user_id BIGINT      NOT NULL,
  -- assigned | unassigned | status | due_date | done | reopened
  event          TEXT        NOT NULL,
  from_value     TEXT,
  to_value       TEXT,
  status_done    BOOLEAN,
  due_date       DATE,
  -- Monday's own item_updated_at when it gives one, the sync time otherwise.
  -- Accurate to the sync window, not the minute: six syncs a day means a
  -- hand-off can be up to four hours out. Fine for medians in days, useless
  -- for anything hourly, and nothing in the UI may imply otherwise.
  occurred_at    TIMESTAMPTZ NOT NULL,
  detected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The same change seen twice by two syncs is one change.
  UNIQUE (board_id, item_id, people_col, monday_user_id, event, occurred_at)
);

CREATE INDEX IF NOT EXISTS monday_assignment_events_person_idx
  ON monday_assignment_events (monday_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS monday_assignment_events_board_idx
  ON monday_assignment_events (board_id, occurred_at DESC);
-- Spans are read as assigned → done for one item, step and person.
CREATE INDEX IF NOT EXISTS monday_assignment_events_span_idx
  ON monday_assignment_events (item_id, people_col, monday_user_id, occurred_at);

ALTER TABLE monday_assignment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monday_assignment_events_read ON monday_assignment_events;
CREATE POLICY monday_assignment_events_read ON monday_assignment_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS monday_assignment_events_admin_write ON monday_assignment_events;
CREATE POLICY monday_assignment_events_admin_write ON monday_assignment_events
  FOR ALL TO authenticated
  USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())));

-- When recording began, so the Report can print it instead of showing a zero
-- that looks like "nothing happened" when it means "we were not watching yet".
CREATE OR REPLACE VIEW monday_assignment_events_since AS
  SELECT min(detected_at) AS started_at, count(*) AS events
  FROM monday_assignment_events;

COMMIT;
