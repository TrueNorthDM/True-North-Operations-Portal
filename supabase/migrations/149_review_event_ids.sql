-- The annual review's meeting and 6-month check-in point at their Agenda
-- event (agenda_events.id), which is a number, not a uuid as migration 148
-- had it. Both tables are new and empty, so the columns change in place.
-- Safe to run again.

BEGIN;
ALTER TABLE reviews         ALTER COLUMN meeting_event_id TYPE BIGINT USING NULL;
ALTER TABLE review_checkins ALTER COLUMN event_id         TYPE BIGINT USING NULL;
COMMIT;

NOTIFY pgrst, 'reload schema';
