-- Agenda and Google Calendar, two-way (owner, 30 October 2026: "faça tudo
-- agora"): every 5 minutes the portal asks each Google-connected account what
-- changed since the last time (Google's sync token). An event the portal made
-- that was changed or deleted in Google follows here; an event added straight
-- to the team calendar (office@) shows on the Agenda.

BEGIN;

ALTER TABLE agenda_account_tokens ADD COLUMN IF NOT EXISTS sync_token  TEXT;
ALTER TABLE agenda_account_tokens ADD COLUMN IF NOT EXISTS synced_at   TIMESTAMPTZ;

-- One portal event per Google event on an account.
CREATE INDEX IF NOT EXISTS agenda_events_google_idx ON agenda_events (sent_from_account_id, google_event_id) WHERE google_event_id IS NOT NULL;

COMMIT;
