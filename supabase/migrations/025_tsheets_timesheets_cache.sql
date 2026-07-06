-- Migration 025: local cache of i7 timesheet entries.
--
-- Until now the i7 Budget Usage Report called the TSheets API live on every page
-- load (the multi-month carryover made that a multi-second, sometimes >60s,
-- request). This table is the cache the background sync (cron, 6×/day) writes to,
-- so the page reads hours straight from Postgres and renders instantly.
--
-- Only i7 entries are stored (a fraction of the whole account). The two custom
-- fields the report groups by are flattened into columns:
--   i7_code  = "1 - i7 Code" (129628) → project prefix + job code (e.g. WM-MKTG)
--   activity = "3 Activity"  (19156)  → e.g. "Content: Writing"
--
-- Retention is a rolling 24-month window (floor: Jan 2026). Rows older than the
-- window are pruned each sync — see src/lib/tsheets/retention.ts.

CREATE TABLE IF NOT EXISTS tsheets_timesheets (
  id          BIGINT PRIMARY KEY,               -- TSheets timesheet id
  user_id     BIGINT NOT NULL,
  jobcode_id  BIGINT NOT NULL,
  duration    INTEGER NOT NULL,                 -- seconds
  date        DATE NOT NULL,
  i7_code     TEXT,                             -- customfield "1 - i7 Code"
  activity    TEXT,                             -- customfield "3 Activity"
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The report always slices by date range (a month, or Jan → month for carryover).
CREATE INDEX IF NOT EXISTS tsheets_timesheets_date_idx ON tsheets_timesheets (date);
