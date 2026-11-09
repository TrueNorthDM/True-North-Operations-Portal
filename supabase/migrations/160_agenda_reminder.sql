-- Agenda, a Reminder type (owner, 8 November 2026): a note on the calendar, all
-- day or a few days, with no time, no Online or In person and nobody invited.
-- Seen by its creator only, the chosen teams, or everyone; for everyone it also
-- goes to the team calendar (office@) with no attendees. Only the allowed types
-- change here: who sees it reuses the audience values already in place.

BEGIN;

ALTER TABLE agenda_events DROP CONSTRAINT IF EXISTS agenda_events_type_check;
ALTER TABLE agenda_events ADD CONSTRAINT agenda_events_type_check
  CHECK (type IN ('meeting', 'training', 'deadline', 'milestone', 'company', 'celebration', 'reminder'));

COMMIT;
