-- 112_clocky_foundation.sql
--
-- Clocky, step 1: the data behind the clock, Time entries, time corrections,
-- Clock safety and the timesheet periods (design handoff of 16 October 2026,
-- Design/design_handoff_clocky; build split in docs/time-clock/05-clocky-build.md).
--
-- 1. Entries keep two sets of times. started_at / ended_at / duration_seconds
--    stay the numbers that count: every portal entry is rounded to the nearest
--    15 minutes before it is saved (8:07 is 8:00, 8:08 is 8:15), and that is
--    what is totalled, billed and reported. What really happened is kept beside
--    it (started_at_real, ended_at_real) for the entry's history ("Clocked in at
--    8:07 AM, recorded as 8:00 AM"). Imported QuickBooks Time rows were rounded
--    by QuickBooks Time and have no real times.
--
-- 2. The safety net counts across job switches: session_started_at is the
--    clock in, carried to every entry a switch creates; window_started_at is the
--    start of the current 5-hour window (the clock in, moved by "Keep going").
--    auto_stopped_at is the moment Clocky stopped the clock (the 5-hour mark);
--    end_confirmed_at / end_confirmed_by / end_flagged record the person's
--    answer ("I was still working until..." is flagged for the approver).
--    clocked_out_by is the Super Admin who used "Clock out for them";
--    edited_by / edited_at give the "Edited" pill; changed_here_at marks an
--    imported entry the portal has changed, which the import then leaves alone
--    (audit finding C1: a later import used to undo such a change).
--
-- 3. Every human change carries its reason in tc_entry_audit, with the new
--    actions the clock writes. before / after already hold the old and new values.
--
-- 4. tc_correction_requests: a User asks for missing time; it counts only once
--    approved, when it becomes a normal entry (entry_id).
--
-- 5. tc_combinations: a person's saved job + fields + note.
--
-- 6. Timesheet periods: each person submits monthly or every 2 weeks.
--    tc_person_cadence keeps each change with the day it takes effect, so a
--    change never cuts a period in half (lib/timeclock/periods.ts works the
--    dates out); a person with no row follows tc_settings.default_cadence
--    (Clocky pins everyone without a row to the old default before the default
--    changes, so changing it moves nobody already here).
--    tc_settings.pay_period_anchor is the day pay periods count from, and
--    tc_pay_period_anchors keeps its moves (periods already submitted keep their
--    dates). tc_periods.kind says whether a period is a month or a pay period.
--
-- 7. tc_safety_events: every "Still working?" warning, every "Keep going" and
--    every automatic stop, for Clock safety and the notifications.
--
-- 8. notifications.done_note: what the person did about a bell row ("You kept
--    going at 12:31 PM. Clocky asks again in 4h 30m.").
--
-- 9. tc_job_field_defaults(): the smart defaults, the most frequent Company,
--    Project and Billable of each job over the last year, in one read.
--
-- Every new table is read and written by the server only (the privileged
-- client, after the access decision in app code): row-level security on, and
-- nothing granted to the anonymous or the signed-in role. Migration 113 closes
-- direct writes on the tables that already existed.

BEGIN;

-- ── 1 and 2. Entries ───────────────────────────────────────────────────────
ALTER TABLE tc_entries
  ADD COLUMN IF NOT EXISTS started_at_real    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at_real      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS window_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_stopped_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_confirmed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_confirmed_by   UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS end_flagged        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clocked_out_by     UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_by          UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changed_here_at    TIMESTAMPTZ;

-- Automatic stops still waiting for the person's real end time (the red button).
CREATE INDEX IF NOT EXISTS tc_entries_auto_unconfirmed_idx
  ON tc_entries (person_id) WHERE auto_stopped_at IS NOT NULL AND end_confirmed_at IS NULL;

-- ── 3. The reason for every change ─────────────────────────────────────────
ALTER TABLE tc_entry_audit ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE tc_entry_audit DROP CONSTRAINT IF EXISTS tc_entry_audit_action_check;
ALTER TABLE tc_entry_audit ADD CONSTRAINT tc_entry_audit_action_check CHECK (action IN (
  -- My Hours, before Clocky: kept for the rows already written.
  'create', 'update', 'delete',
  -- The clock.
  'clock_in', 'switch', 'clock_out', 'undo_clock_out', 'auto_stop', 'confirm_end', 'keep_going',
  -- People changing hours (a reason each), and what follows from a decision.
  'add', 'edit', 'trim', 'grid', 'clocked_out_for', 'correction_approved', 'imported', 'reopen'
));

-- The changes a person makes by hand say why. 'delete' is checked by the
-- server instead: My Hours wrote it without a reason before Clocky.
ALTER TABLE tc_entry_audit DROP CONSTRAINT IF EXISTS tc_entry_audit_reason_check;
ALTER TABLE tc_entry_audit ADD CONSTRAINT tc_entry_audit_reason_check CHECK (
  action NOT IN ('add', 'edit', 'trim', 'grid', 'clocked_out_for')
  OR length(btrim(COALESCE(reason, ''))) > 0
);

-- ── 4. Time correction requests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tc_correction_requests (
  id             BIGSERIAL PRIMARY KEY,
  person_id      UUID    NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  -- The day, in the person's own time zone, and the instants asked for
  -- (already on 15-minute steps).
  entry_date     DATE    NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ NOT NULL,
  jobcode_id     INTEGER NOT NULL REFERENCES tc_jobcodes(id) ON DELETE RESTRICT,
  fields         JSONB   NOT NULL DEFAULT '{}'::jsonb,   -- keyed by tc_fields.id, as on tc_entries
  notes          TEXT,
  -- "What happened": required.
  reason         TEXT    NOT NULL CHECK (length(btrim(reason)) > 0),
  state          TEXT    NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'denied')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by     UUID REFERENCES people(id) ON DELETE SET NULL,
  decided_at     TIMESTAMPTZ,
  decision_note  TEXT,
  -- The entry an approval created.
  entry_id       BIGINT REFERENCES tc_entries(id) ON DELETE SET NULL,
  CHECK (ended_at > started_at),
  -- Denying needs a reason; the requester is told it.
  CHECK (state <> 'denied' OR length(btrim(COALESCE(decision_note, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS tc_correction_requests_person_idx ON tc_correction_requests (person_id, entry_date);
CREATE INDEX IF NOT EXISTS tc_correction_requests_pending_idx ON tc_correction_requests (requested_at) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS tc_correction_requests_entry_idx ON tc_correction_requests (entry_id) WHERE entry_id IS NOT NULL;

-- ── 5. Saved combinations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tc_combinations (
  id          BIGSERIAL PRIMARY KEY,
  person_id   UUID    NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL CHECK (length(btrim(name)) > 0),
  jobcode_id  INTEGER NOT NULL REFERENCES tc_jobcodes(id) ON DELETE RESTRICT,
  fields      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  notes       TEXT,
  -- The person's order; the panel shows the first six.
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tc_combinations_person_idx ON tc_combinations (person_id, position);

-- ── 6. Timesheet periods ───────────────────────────────────────────────────
ALTER TABLE tc_settings
  ADD COLUMN IF NOT EXISTS pay_period_anchor DATE,
  ADD COLUMN IF NOT EXISTS default_cadence   TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE tc_settings DROP CONSTRAINT IF EXISTS tc_settings_default_cadence_check;
ALTER TABLE tc_settings ADD CONSTRAINT tc_settings_default_cadence_check
  CHECK (default_cadence IN ('monthly', 'biweekly'));

-- How each person submits, from the day each change takes effect.
CREATE TABLE IF NOT EXISTS tc_person_cadence (
  id              BIGSERIAL PRIMARY KEY,
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  cadence         TEXT NOT NULL CHECK (cadence IN ('monthly', 'biweekly')),
  effective_from  DATE NOT NULL,
  -- The last stretch of pay periods before monthly starts, which closes as ONE
  -- period however long it is (11A: "they close as one last pay period").
  one_period      BOOLEAN NOT NULL DEFAULT false,
  set_by          UUID REFERENCES people(id) ON DELETE SET NULL,
  set_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person_id, effective_from)
);

-- Where pay periods count from, from the day each move takes effect. The
-- first row (effective_from null) counts for every day before the next one.
CREATE TABLE IF NOT EXISTS tc_pay_period_anchors (
  id              BIGSERIAL PRIMARY KEY,
  anchor          DATE NOT NULL,
  effective_from  DATE UNIQUE,
  set_by          UUID REFERENCES people(id) ON DELETE SET NULL,
  set_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tc_pay_period_anchors_one_first
  ON tc_pay_period_anchors ((true)) WHERE effective_from IS NULL;

ALTER TABLE tc_periods ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'month';
ALTER TABLE tc_periods DROP CONSTRAINT IF EXISTS tc_periods_kind_check;
ALTER TABLE tc_periods ADD CONSTRAINT tc_periods_kind_check CHECK (kind IN ('month', 'pay_period'));

-- ── 7. Clock safety ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tc_safety_events (
  id                  BIGSERIAL PRIMARY KEY,
  person_id           UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  entry_id            BIGINT REFERENCES tc_entries(id) ON DELETE SET NULL,
  -- warned: "Still working?" at 4h 30m; keep_going: the person answered;
  -- auto_stop: Clocky stopped the clock at the 5h mark.
  kind                TEXT NOT NULL CHECK (kind IN ('warned', 'keep_going', 'auto_stop')),
  at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The window the event belongs to (its start), and the clock in.
  window_started_at   TIMESTAMPTZ NOT NULL,
  session_started_at  TIMESTAMPTZ,
  -- The job running at the time, kept here so the log survives edits.
  jobcode_id          INTEGER REFERENCES tc_jobcodes(id) ON DELETE SET NULL,
  -- auto_stop only: where the clock stopped, and the person's answer.
  stopped_at          TIMESTAMPTZ,
  confirmed_end_at    TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  flagged             BOOLEAN NOT NULL DEFAULT false,
  -- Each window is warned once, kept going once and stopped once, however
  -- many times the job looks.
  UNIQUE (person_id, kind, window_started_at)
);
CREATE INDEX IF NOT EXISTS tc_safety_events_at_idx ON tc_safety_events (kind, at DESC);
CREATE INDEX IF NOT EXISTS tc_safety_events_entry_idx ON tc_safety_events (entry_id) WHERE entry_id IS NOT NULL;

-- ── 8. A bell row that was acted on ────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS done_note TEXT;

-- ── 9. Smart defaults in one read ──────────────────────────────────────────
-- For each job, the value each field (p_keys: tc_fields ids as text) carries
-- most often on entries since p_since; a tie goes to the most recent.
-- { "<jobcode id>": { "<field id>": "<value>" } }
CREATE OR REPLACE FUNCTION public.tc_job_field_defaults(p_since DATE, p_keys TEXT[])
RETURNS JSONB
LANGUAGE SQL STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(d.jobcode_id::text, d.vals), '{}'::jsonb)
    FROM (
      SELECT m.jobcode_id, jsonb_object_agg(m.field_key, m.value) AS vals
        FROM (
          SELECT DISTINCT ON (e.jobcode_id, f.field_key)
                 e.jobcode_id, f.field_key, e.fields ->> f.field_key AS value
            FROM tc_entries e
            CROSS JOIN unnest(COALESCE(p_keys, '{}')) AS f(field_key)
           WHERE e.entry_date >= p_since
             AND e.jobcode_id IS NOT NULL
             AND COALESCE(e.fields ->> f.field_key, '') <> ''
           GROUP BY e.jobcode_id, f.field_key, e.fields ->> f.field_key
           ORDER BY e.jobcode_id, f.field_key, count(*) DESC, max(e.entry_date) DESC
        ) m
       GROUP BY m.jobcode_id
    ) d
$$;

REVOKE ALL ON FUNCTION public.tc_job_field_defaults(DATE, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tc_job_field_defaults(DATE, TEXT[]) TO service_role;

-- ── Server only ────────────────────────────────────────────────────────────
ALTER TABLE tc_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_combinations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_person_cadence      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_pay_period_anchors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tc_safety_events       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON tc_correction_requests, tc_combinations, tc_person_cadence,
              tc_pay_period_anchors, tc_safety_events
  FROM anon, authenticated;
REVOKE ALL ON SEQUENCE tc_correction_requests_id_seq, tc_combinations_id_seq, tc_person_cadence_id_seq,
                       tc_pay_period_anchors_id_seq, tc_safety_events_id_seq
  FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
