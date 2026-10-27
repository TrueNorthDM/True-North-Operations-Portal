-- 129_north_time_waves.sql
--
-- North Time start date per person (owner's decision, 27 October 2026). The
-- rollout is in two waves:
--
--   wave 1  everyone at Team Leader level or above (Super Admin, Admin, Lead
--           of any team), plus anyone added by hand; Sunday, Nov 8, 2026
--   wave 2  everyone else; Sunday, Nov 22, 2026
--
-- The dates are set in Company settings > North Time rollout. Until a wave has
-- a date, nothing changes for the people in it (src/lib/timeclock/waves.ts).
--
--   tc_rollout_waves     the two waves and the day each starts (NULL until set)
--   tc_rollout_people    a person moved to the other wave by hand; without a
--                        row a person's wave follows their level
--   tc_import_skipped    TSheets entries dated on or after the person's start
--                        date: the import no longer writes them to tc_entries,
--                        it keeps them here, whole, until someone decides
--   tc_tsheets_archives  each TSheets account archived on its person's start
--                        date by /api/cron/north-time-archive (only with
--                        TSHEETS_ARCHIVE_USERS=on), so it is archived once
--
-- Server only, like the other settings tables: closed to the anonymous and
-- signed-in roles; the server reads and writes them with the service role.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS tc_rollout_waves (
  wave        SMALLINT PRIMARY KEY CHECK (wave IN (1, 2)),
  starts_on   DATE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES people(id) ON DELETE SET NULL
);
INSERT INTO tc_rollout_waves (wave) VALUES (1), (2) ON CONFLICT (wave) DO NOTHING;

CREATE TABLE IF NOT EXISTS tc_rollout_people (
  person_id   UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  wave        SMALLINT NOT NULL CHECK (wave IN (1, 2)),
  set_by      UUID REFERENCES people(id) ON DELETE SET NULL,
  set_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tc_import_skipped (
  external_id       BIGINT PRIMARY KEY,                  -- the TSheets timesheet id
  person_id         UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tsheets_user_id   BIGINT NOT NULL,
  entry_date        DATE NOT NULL,
  starts_on         DATE NOT NULL,                       -- the person's start date when it was set aside
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  jobcode_id        INTEGER REFERENCES tc_jobcodes(id) ON DELETE SET NULL,
  job_path          TEXT,
  kind              TEXT,
  state             TEXT,
  notes             TEXT,
  fields            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- tc_fields id -> value, as tc_entries keeps them
  raw               JSONB NOT NULL,                      -- the timesheet exactly as TSheets sent it
  already_in_entries BOOLEAN NOT NULL DEFAULT false,     -- imported to tc_entries before the date was set
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_in_tsheets_at TIMESTAMPTZ,
  decided_at        TIMESTAMPTZ,
  decided_by        UUID REFERENCES people(id) ON DELETE SET NULL,
  decision          TEXT CHECK (decision IS NULL OR decision IN ('imported', 'dismissed'))
);
CREATE INDEX IF NOT EXISTS tc_import_skipped_person_date ON tc_import_skipped (person_id, entry_date);

CREATE TABLE IF NOT EXISTS tc_tsheets_archives (
  tsheets_user_id  BIGINT PRIMARY KEY,
  person_id        UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  starts_on        DATE NOT NULL,
  archived_at      TIMESTAMPTZ,
  last_error       TEXT,
  tried_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tc_rollout_waves    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_rollout_people   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_import_skipped   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_tsheets_archives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tc_rollout_waves, tc_rollout_people, tc_import_skipped, tc_tsheets_archives FROM anon, authenticated;

COMMIT;
