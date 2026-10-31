-- Agenda: recurring events (owner, 30 October 2026, as Google Calendar does
-- them). A series is one event row with its rule in Google's own words
-- (recurrence: an RRULE line) and the last day it can happen (recur_until,
-- null when it never ends), so a month's view finds the series that began
-- before it. One occurrence changed on its own ("This event") is its own row,
-- tied to the series (series_id) and to the day it replaces (original_day);
-- days taken out of the series, deleted or moved, are in skip_days.

BEGIN;

ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS recurrence    TEXT CHECK (recurrence IS NULL OR recurrence LIKE 'RRULE:%');
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS recur_until   DATE;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS skip_days     DATE[] NOT NULL DEFAULT '{}';
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS series_id     BIGINT REFERENCES agenda_events(id) ON DELETE CASCADE;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS original_day  DATE;

ALTER TABLE agenda_events DROP CONSTRAINT IF EXISTS agenda_events_occurrence_check;
ALTER TABLE agenda_events ADD CONSTRAINT agenda_events_occurrence_check CHECK ((series_id IS NULL) = (original_day IS NULL) AND (series_id IS NULL OR recurrence IS NULL));

CREATE INDEX IF NOT EXISTS agenda_events_series_idx ON agenda_events (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agenda_events_recurring_idx ON agenda_events (start_date, recur_until) WHERE recurrence IS NOT NULL;

COMMIT;
