-- Agenda and Google Calendar, busy times (owner, 30 October 2026): the portal
-- reads when each Google-connected account is busy (Google's free/busy, never
-- what the events are) into agenda_busy with source 'google'. These columns
-- say which stretch was last read and when, so Find a time and the booking
-- page ask Google again only when the copy is older than a few minutes.

BEGIN;

ALTER TABLE agenda_account_tokens ADD COLUMN IF NOT EXISTS busy_from    TIMESTAMPTZ;
ALTER TABLE agenda_account_tokens ADD COLUMN IF NOT EXISTS busy_to      TIMESTAMPTZ;
ALTER TABLE agenda_account_tokens ADD COLUMN IF NOT EXISTS busy_read_at TIMESTAMPTZ;

COMMIT;
