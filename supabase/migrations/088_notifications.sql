-- 088_notifications.sql
--
-- The portal's notifications, decided on 22 September 2026.
--
-- Four tables:
--   notification_rules   the admin's rule per notification type: a default for
--                        on/off, when (as it happens, daily summary) and where
--                        (in app, email, both), and whether people may change
--                        each one or it is fixed. A type with no row uses the
--                        catalogue's default (src/lib/notifications/catalogue.ts).
--   notification_prefs   a person's own choices, per type. A null column follows
--                        the rule's default. Kept while the admin has the setting
--                        fixed, so it comes back if the admin opens it again.
--   notifications        what each person gets. deliver_at is when it lands: now
--                        for "as it happens", the next 8:00 New York for the
--                        daily summary. Unique per (person, type, dedupe_key),
--                        so the same thing found by two runs is one notification.
--   notification_state   small memory between runs (the Monday accounts already
--                        seen, so each new one is told once).
--
-- Who reads and writes: the server, with the service role, for the person it
-- has already identified. The directory person behind a login is usually found
-- by email, which a row-level rule on auth.uid() cannot see, so the tables are
-- closed to the signed-in role except for admins, who may read them.
--
-- Retention (done by the sync, not here): read notifications go after 30 days,
-- unread ones after 90.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_rules (
  type_key    TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  timing      TEXT    NOT NULL CHECK (timing IN ('instant','daily')),
  channel     TEXT    NOT NULL DEFAULT 'app' CHECK (channel IN ('app','email','both')),
  fix_enabled BOOLEAN NOT NULL DEFAULT false,
  fix_timing  BOOLEAN NOT NULL DEFAULT false,
  fix_channel BOOLEAN NOT NULL DEFAULT false,
  updated_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type_key   TEXT NOT NULL,
  enabled    BOOLEAN,
  timing     TEXT CHECK (timing IN ('instant','daily')),
  channel    TEXT CHECK (channel IN ('app','email','both')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, type_key)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type_key    TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  href        TEXT,
  dedupe_key  TEXT NOT NULL,
  timing      TEXT NOT NULL CHECK (timing IN ('instant','daily')),
  deliver_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, type_key, dedupe_key)
);
-- The drawer: one person's landed notifications, newest first.
CREATE INDEX IF NOT EXISTS notifications_inbox_idx ON notifications (person_id, deliver_at DESC);
-- The clean-up.
CREATE INDEX IF NOT EXISTS notifications_deliver_idx ON notifications (deliver_at);

CREATE TABLE IF NOT EXISTS notification_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_state ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['notification_rules','notification_prefs','notifications','notification_state']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_read ON %I', t, t);
    EXECUTE format($f$CREATE POLICY %I_admin_read ON %I FOR SELECT TO authenticated
                      USING ((SELECT is_admin(auth.uid())))$f$, t, t);
  END LOOP;
END $$;

COMMIT;
