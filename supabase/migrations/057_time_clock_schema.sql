-- 057_time_clock_schema.sql
--
-- Phase 0 of the portal's own time clock. Tables only: nothing reads or writes
-- these yet, and nothing outside the portal is connected. QuickBooks Time stays
-- the system of record until the cutover.
--
-- The shape of these tables comes from the survey in
-- docs/time-clock/01-tsheets-account-inventory.md. Three findings drove it:
--
--   * 8.7% of the 136,167 entries are "manual" and have no clock in or out, so
--     start/end have to be nullable while duration is always present.
--   * 519 of the 545 job codes are deactivated, and that is where ten years of
--     history lives. Nothing here filters on `active` to read; `active` only
--     decides what a person may pick today.
--   * TSheets rounds every clock in and out to the quarter hour before storing
--     it. We store what happened and round on the way out, so the rule lives in
--     tc_settings instead of in the data.
--
-- IDENTITY. A person is `people`, the same row the rest of the portal uses.
-- The import links through the existing people.tsheets_user_id, and creates
-- people with tsheets_only = true, status = 'inactive' for the 44 former
-- employees who own history but were never in the directory.
--
-- MIGRATION SAFETY. Every imported row keeps its TSheets id in external_id with
-- a unique index, so the import is an upsert and can run as many times as we
-- like before the cutover. Rows created in the portal have no external_id, and
-- the import must never touch them.
--
-- RLS. Admin only, read and write, on every table here. Nothing else needs them
-- yet, and the audit that closed seven publicly readable tables is recent
-- enough to justify starting closed and opening exactly what each later phase
-- proves it needs (phase 2: a person's own entries; phase 3: their approver;
-- phase 5: the reports).

-- ─── Settings, one row ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_settings (
  singleton_id        INTEGER PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  timezone            TEXT    NOT NULL DEFAULT 'America/New_York',
  week_start          INTEGER NOT NULL DEFAULT 0 CHECK (week_start BETWEEN 0 AND 6),
  period_type         TEXT    NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly','semimonthly','biweekly','weekly')),

  -- Applied when producing payroll, never when storing. 'nearest' | 'up' | 'down'.
  round_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  round_minutes       INTEGER NOT NULL DEFAULT 15 CHECK (round_minutes BETWEEN 1 AND 60),
  round_direction     TEXT    NOT NULL DEFAULT 'nearest' CHECK (round_direction IN ('nearest','up','down')),

  auto_clockout_hours INTEGER,                      -- NULL = never; TSheets has 8
  split_at_midnight   BOOLEAN NOT NULL DEFAULT TRUE,
  calculate_overtime  BOOLEAN NOT NULL DEFAULT FALSE,
  daily_regular_hours NUMERIC(5,2) NOT NULL DEFAULT 8,
  weekly_regular_hours NUMERIC(5,2) NOT NULL DEFAULT 40,

  -- The import never reads entries dated after this. Before the cutover it is
  -- "today", so TSheets stays the truth; on cutover day it is frozen, and from
  -- then on the portal is the only source for later dates. Without it, running
  -- the import during the parallel period would duplicate any day someone had
  -- already entered here.
  import_cutoff_date  DATE,

  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO tc_settings (singleton_id) VALUES (1) ON CONFLICT DO NOTHING;

-- ─── Job codes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_jobcodes (
  id          SERIAL PRIMARY KEY,
  external_id BIGINT UNIQUE,                        -- TSheets jobcode id
  parent_id   INTEGER REFERENCES tc_jobcodes(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'regular' CHECK (kind IN ('regular','pto','unpaid')),
  billable    BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tc_jobcodes_parent_idx ON tc_jobcodes (parent_id);
CREATE INDEX IF NOT EXISTS tc_jobcodes_active_idx ON tc_jobcodes (active);

-- ─── The entry form, as data ────────────────────────────────────────────────
-- Seeded from the six TSheets custom fields, including the two switched off:
-- old entries still carry their values and must not lose their labels.

CREATE TABLE IF NOT EXISTS tc_fields (
  id          SERIAL PRIMARY KEY,
  external_id BIGINT UNIQUE,
  name        TEXT    NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  required    BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tc_field_options (
  id          SERIAL PRIMARY KEY,
  field_id    INTEGER NOT NULL REFERENCES tc_fields(id) ON DELETE CASCADE,
  external_id BIGINT,
  label       TEXT    NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (field_id, label)
);
CREATE INDEX IF NOT EXISTS tc_field_options_field_idx ON tc_field_options (field_id);

-- ─── Entries ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_entries (
  id            BIGSERIAL PRIMARY KEY,
  external_id   BIGINT UNIQUE,                      -- TSheets timesheet id; NULL = born here
  person_id     UUID    NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  jobcode_id    INTEGER REFERENCES tc_jobcodes(id) ON DELETE RESTRICT,

  -- Nullable together: an imported 'manual' entry never had them, and a running
  -- clock has no end yet. duration_seconds is always the number to trust.
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),

  -- The day the entry belongs to in the company timezone. Kept as its own
  -- column because every report groups by it, and it must not move if the
  -- timezone setting ever changes.
  entry_date    DATE    NOT NULL,

  kind          TEXT    NOT NULL DEFAULT 'clock' CHECK (kind IN ('clock','manual','absence')),
  state         TEXT    NOT NULL DEFAULT 'open'  CHECK (state IN ('open','submitted','approved','locked')),
  notes         TEXT,
  fields        JSONB   NOT NULL DEFAULT '{}'::jsonb,   -- keyed by tc_fields.id
  source        TEXT    NOT NULL DEFAULT 'portal' CHECK (source IN ('portal','tsheets')),

  created_by    UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A clock entry that has stopped must have both ends; a manual one needs neither.
  CONSTRAINT tc_entries_clock_has_ends CHECK (
    kind <> 'clock' OR ended_at IS NULL OR started_at IS NOT NULL
  ),
  CONSTRAINT tc_entries_ends_after_start CHECK (
    started_at IS NULL OR ended_at IS NULL OR ended_at >= started_at
  )
);
CREATE INDEX IF NOT EXISTS tc_entries_date_idx        ON tc_entries (entry_date);
CREATE INDEX IF NOT EXISTS tc_entries_person_date_idx ON tc_entries (person_id, entry_date);
CREATE INDEX IF NOT EXISTS tc_entries_jobcode_idx     ON tc_entries (jobcode_id);
CREATE INDEX IF NOT EXISTS tc_entries_state_idx       ON tc_entries (state);
CREATE INDEX IF NOT EXISTS tc_entries_fields_gin      ON tc_entries USING GIN (fields);
-- One running clock per person, enforced by the database rather than by hoping
-- the UI never double-fires.
CREATE UNIQUE INDEX IF NOT EXISTS tc_entries_one_open_per_person
  ON tc_entries (person_id) WHERE ended_at IS NULL AND kind = 'clock';

-- ─── Audit ──────────────────────────────────────────────────────────────────
-- We are replacing the record of hours worked. Every edit leaves a trace, and
-- writing it from the first day costs almost nothing.

CREATE TABLE IF NOT EXISTS tc_entry_audit (
  id         BIGSERIAL PRIMARY KEY,
  entry_id   BIGINT REFERENCES tc_entries(id) ON DELETE SET NULL,
  action     TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  changed_by UUID REFERENCES people(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before     JSONB,
  after      JSONB
);
CREATE INDEX IF NOT EXISTS tc_entry_audit_entry_idx ON tc_entry_audit (entry_id);

-- ─── Pay periods and approval ───────────────────────────────────────────────
-- TSheets keeps one submitted_to and one approved_to date on the user, which
-- cannot answer "who approved March" once April has been submitted.

CREATE TABLE IF NOT EXISTS tc_periods (
  id         SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  closed_at  TIMESTAMPTZ,
  UNIQUE (start_date, end_date),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS tc_submissions (
  id            SERIAL PRIMARY KEY,
  person_id     UUID    NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  period_id     INTEGER NOT NULL REFERENCES tc_periods(id) ON DELETE CASCADE,
  state         TEXT    NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','submitted','approved','returned')),
  submitted_at  TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES people(id) ON DELETE SET NULL,
  note          TEXT,
  UNIQUE (person_id, period_id)
);

-- ─── Absence ────────────────────────────────────────────────────────────────
-- Absence stops being just another job code. An approved request generates the
-- tc_entries rows, so the timecard stays right without anyone typing hours.

CREATE TABLE IF NOT EXISTS tc_absence_requests (
  id             SERIAL PRIMARY KEY,
  person_id      UUID    NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  jobcode_id     INTEGER NOT NULL REFERENCES tc_jobcodes(id) ON DELETE RESTRICT,
  start_date     DATE    NOT NULL,
  end_date       DATE    NOT NULL,
  hours_per_day  NUMERIC(5,2) NOT NULL DEFAULT 8,
  state          TEXT    NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','denied','cancelled')),
  reason         TEXT,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by     UUID REFERENCES people(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decision_note  TEXT,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS tc_absence_requests_person_idx ON tc_absence_requests (person_id, start_date);

-- Seeded once at cutover from the TSheets pto_balances on each user, because
-- the requests behind those balances are not exposed by the API and cannot be
-- migrated.
CREATE TABLE IF NOT EXISTS tc_absence_balances (
  id             SERIAL PRIMARY KEY,
  person_id      UUID    NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  jobcode_id     INTEGER NOT NULL REFERENCES tc_jobcodes(id) ON DELETE RESTRICT,
  year           INTEGER NOT NULL,
  accrued_hours  NUMERIC(7,2) NOT NULL DEFAULT 0,
  used_hours     NUMERIC(7,2) NOT NULL DEFAULT 0,
  carried_hours  NUMERIC(7,2) NOT NULL DEFAULT 0,
  UNIQUE (person_id, jobcode_id, year)
);

-- ─── Import bookkeeping ─────────────────────────────────────────────────────
-- The full pull is 136,167 entries over roughly 45 minutes of paging, which is
-- far longer than one function invocation. Progress is a row, so a run can stop
-- and pick up where it left off, and so the reconciliation has something to
-- compare against.

CREATE TABLE IF NOT EXISTS tc_import_runs (
  id             SERIAL PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('full','delta')),
  state          TEXT NOT NULL DEFAULT 'running' CHECK (state IN ('running','done','failed')),
  cursor_date    DATE,                              -- next month still to pull
  modified_since TIMESTAMPTZ,                       -- delta watermark
  entries_seen   INTEGER NOT NULL DEFAULT 0,
  entries_written INTEGER NOT NULL DEFAULT 0,
  entries_deleted INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);

-- Their number against ours, month by month. Phase 1 does not end in "done", it
-- ends here: if March 2019 does not match, the import is wrong and everything
-- built on it inherits the error.
CREATE TABLE IF NOT EXISTS tc_reconciliation (
  id              SERIAL PRIMARY KEY,
  month           TEXT NOT NULL UNIQUE,             -- 'YYYY-MM'
  tsheets_entries INTEGER NOT NULL DEFAULT 0,
  tsheets_seconds BIGINT  NOT NULL DEFAULT 0,
  portal_entries  INTEGER NOT NULL DEFAULT 0,
  portal_seconds  BIGINT  NOT NULL DEFAULT 0,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Closed on purpose. Every later phase opens exactly what it proves it needs.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tc_settings','tc_jobcodes','tc_fields','tc_field_options','tc_entries',
    'tc_entry_audit','tc_periods','tc_submissions','tc_absence_requests',
    'tc_absence_balances','tc_import_runs','tc_reconciliation'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()))',
      t || '_admin_all', t
    );
  END LOOP;
END $$;
