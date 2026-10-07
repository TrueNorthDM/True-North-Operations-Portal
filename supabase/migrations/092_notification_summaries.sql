-- 092_notification_summaries.sql
--
-- The daily summary email, decided on 7 October 2026.
--
-- "When" now decides "where": as it happens lands in the bell; the daily
-- summary lands in the bell at 8:00 and goes out by email, at most two emails a
-- day (one per category, Tools and System), on US working days only. The day
-- after a weekend or a holiday, the summary covers the days in between.
--
--   notifications.emailed_at  when a daily-summary notification went out in a
--                             summary email (or was let go without one). Null:
--                             still waiting for its email.
--   person_settings           a person's own settings, starting with their time
--                             zone: the summary lands at 8:00 in it. No row, or
--                             a null zone, means the company's (New York).
--   notification_digests      one row per person, category and day a summary
--                             was attempted: sent, skipped (staging, no email
--                             service) or failed (with the attempts), so the
--                             same summary is never sent twice and a failing
--                             address is not retried forever.
--
-- Same access as 088: the server reads and writes with the service role; the
-- signed-in role may only read, and only admins.

BEGIN;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- Everything that already landed was never meant for an email: without this,
-- the first run would send everyone two weeks of old notifications.
UPDATE notifications SET emailed_at = now()
 WHERE emailed_at IS NULL AND deliver_at <= now();

-- The summary run: daily notifications still waiting for their email.
CREATE INDEX IF NOT EXISTS notifications_unemailed_idx
  ON notifications (deliver_at) WHERE timing = 'daily' AND emailed_at IS NULL;

CREATE TABLE IF NOT EXISTS person_settings (
  person_id  UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  time_zone  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_digests (
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  category   TEXT NOT NULL CHECK (category IN ('tools','system')),
  local_day  DATE NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('sent','skipped','failed')),
  attempts   INT  NOT NULL DEFAULT 1,
  items      INT  NOT NULL DEFAULT 0,
  error      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, category, local_day)
);

ALTER TABLE person_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_digests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['person_settings','notification_digests']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_read ON %I', t, t);
    EXECUTE format($f$CREATE POLICY %I_admin_read ON %I FOR SELECT TO authenticated
                      USING ((SELECT is_admin(auth.uid())))$f$, t, t);
  END LOOP;
END $$;

COMMIT;
