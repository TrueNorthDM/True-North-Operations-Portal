-- Agenda event card, view mode (owner, 30 October 2026): what the open card
-- shows of an event that is on Google. The event's own Google Calendar page
-- ("Open in Google Calendar"), the id Google gives the same event on every
-- guest's calendar (so a guest's answer from the portal goes on their own
-- copy), and when the guests' answers were last read from Google.

BEGIN;

ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS google_html_link   TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS google_ical_uid    TEXT;
ALTER TABLE agenda_events ADD COLUMN IF NOT EXISTS responses_read_at  TIMESTAMPTZ;

COMMIT;
