-- Agenda, two more types (owner, 10 November 2026): Block time (time held on
-- one's own calendar, seen by its creator alone, busy in Find a time) and
-- Absence (a contractor is away, seen by everyone like time off, on the team
-- calendar). Only the allowed types change here; who sees them reuses the
-- audience values already in place (migration 136, 160). Safe to run twice.

BEGIN;

ALTER TABLE agenda_events DROP CONSTRAINT IF EXISTS agenda_events_type_check;
ALTER TABLE agenda_events ADD CONSTRAINT agenda_events_type_check
  CHECK (type IN ('meeting', 'training', 'deadline', 'milestone', 'company', 'celebration', 'reminder', 'block', 'absence'));

COMMIT;
