-- The Annual Performance Review (design handoff, 3 November 2026): a new
-- module in People > Human Resources, and a Human Resources section in
-- Company settings.
--
-- A review is always between two levels: the person and the one they report
-- to (their Team Leader or, with none, people.manager_id). The roles that run
-- the year (VP of Operations, CISO, HR) are picked in Company settings, never
-- named in code.
--
--   hr_settings              one row: the three roles, who takes part beyond
--                            the employees, the Drive folder.
--   review_cycles            one a year: the dates and when it was started.
--                            Nothing opens until a Super Admin clicks Start.
--   review_priorities        the Company Priorities (team_id null) and each
--                            team's, written in its Team Leader's self-review.
--   review_team_priorities   per cycle and team: draft, sent, approved or sent
--                            back, and when the team's self-reviews opened.
--   reviews                  one per person per cycle: the step, the reviewer
--                            (kept when the review opens), the meeting, the
--                            approval, the PDF and its Drive copy.
--   review_answers           the self-review and Manager's Feedback answers.
--   review_goals             the goals for the coming year, and the goals of
--                            the year being reviewed with how they went. The
--                            same row follows the goal all year (status).
--   review_goal_updates      the person's updates, the manager's comments and
--                            the 6-month check-in comments.
--   review_checkins          the 6-month check-in per person and cycle.
--   review_imports           last year's files from Drive (first year only).
--   review_log               who did what, for the review and Step 0's Changes.
--   review_notices           the emails and reminders already sent (one key
--                            each), so a run never sends twice.
--
-- The server decides and writes, as in North Time: the tables give nothing to
-- the anonymous or signed-in role, and the daily check watches them.
-- Safe to run again.

BEGIN;

-- ── Company settings > Human Resources ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_settings (
  singleton_id     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  vp_operations_id UUID REFERENCES people(id) ON DELETE SET NULL,
  ciso_id          UUID REFERENCES people(id) ON DELETE SET NULL,
  hr_id            UUID REFERENCES people(id) ON DELETE SET NULL,
  extra_people     UUID[] NOT NULL DEFAULT '{}',
  drive_folder_id   TEXT,
  drive_folder_name TEXT,
  drive_folder_path TEXT,
  updated_by       UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO hr_settings (singleton_id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── The year ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_cycles (
  id                 BIGSERIAL PRIMARY KEY,
  year               INTEGER NOT NULL UNIQUE CHECK (year BETWEEN 2025 AND 2100),
  leaders_open_on    DATE,
  leaders_due        DATE,
  teams_open_by      DATE,
  self_due           DATE,
  review_due         DATE,
  meeting_due        DATE,
  approval_due       DATE,
  checkins_by        DATE,
  started_at         TIMESTAMPTZ,
  started_by         UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Priorities ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_priorities (
  id          BIGSERIAL PRIMARY KEY,
  cycle_id    BIGINT NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  body        TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  supports_id BIGINT REFERENCES review_priorities(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_priorities_cycle_idx ON review_priorities (cycle_id, team_id, position);

CREATE TABLE IF NOT EXISTS review_team_priorities (
  cycle_id      BIGINT NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  state         TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','sent','approved','returned')),
  sent_at       TIMESTAMPTZ,
  sent_by       UUID REFERENCES people(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ,
  decided_by    UUID REFERENCES people(id) ON DELETE SET NULL,
  return_reason TEXT CHECK (length(return_reason) <= 2000),
  opened_at     TIMESTAMPTZ,
  PRIMARY KEY (cycle_id, team_id)
);

-- ── The reviews ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id                 BIGSERIAL PRIMARY KEY,
  cycle_id           BIGINT NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  person_id          UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  reviewer_id        UUID REFERENCES people(id) ON DELETE SET NULL,
  team_id            UUID REFERENCES teams(id) ON DELETE SET NULL,
  phase              SMALLINT NOT NULL DEFAULT 2 CHECK (phase IN (1, 2)),
  step               TEXT NOT NULL DEFAULT 'waiting'
                     CHECK (step IN ('waiting','self','review','meeting','approval','approved')),
  opened_at          TIMESTAMPTZ,
  self_sent_at       TIMESTAMPTZ,
  review_sent_at     TIMESTAMPTZ,
  meeting_event_id   UUID,
  meeting_starts_at  TIMESTAMPTZ,
  meeting_ends_at    TIMESTAMPTZ,
  meeting_notes      TEXT NOT NULL DEFAULT '' CHECK (length(meeting_notes) <= 20000),
  agreed_at          TIMESTAMPTZ,
  approved_at        TIMESTAMPTZ,
  approved_by        UUID REFERENCES people(id) ON DELETE SET NULL,
  sent_back_at       TIMESTAMPTZ,
  sent_back_by       UUID REFERENCES people(id) ON DELETE SET NULL,
  sent_back_reason   TEXT CHECK (length(sent_back_reason) <= 2000),
  sent_back_from     TEXT,
  pdf_path           TEXT,
  pdf_name           TEXT,
  drive_status       TEXT CHECK (drive_status IN ('waiting','saved','failed')),
  drive_file_id      TEXT,
  drive_error        TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, person_id)
);
CREATE INDEX IF NOT EXISTS reviews_person_idx ON reviews (person_id);
CREATE INDEX IF NOT EXISTS reviews_reviewer_idx ON reviews (reviewer_id, step);

CREATE TABLE IF NOT EXISTS review_answers (
  review_id   BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  key         TEXT NOT NULL CHECK (key ~ '^[a-z_]{2,40}$'),
  body        TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
  copied      BOOLEAN NOT NULL DEFAULT false,
  updated_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, key)
);

-- One goal, for its whole life. `review_id` is the review that set it (null
-- for the goals typed in by hand from last year's file); `marked_in` is the
-- review where it was marked Met, Partly met, Not met or No longer relevant.
CREATE TABLE IF NOT EXISTS review_goals (
  id              BIGSERIAL PRIMARY KEY,
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  review_id       BIGINT REFERENCES reviews(id) ON DELETE CASCADE,
  goal_year       INTEGER NOT NULL CHECK (goal_year BETWEEN 2025 AND 2101),
  position        INTEGER NOT NULL DEFAULT 0,
  what            TEXT NOT NULL DEFAULT '' CHECK (length(what) <= 500),
  how             TEXT NOT NULL DEFAULT '' CHECK (length(how) <= 1000),
  by_month        DATE CHECK (by_month IS NULL OR extract(day FROM by_month) = 1),
  term            TEXT CHECK (term IN ('6m','1y')),
  priority_id     BIGINT REFERENCES review_priorities(id) ON DELETE SET NULL,
  added_by        UUID REFERENCES people(id) ON DELETE SET NULL,
  added_by_reviewer BOOLEAN NOT NULL DEFAULT false,
  changed_by      UUID REFERENCES people(id) ON DELETE SET NULL,
  original        JSONB,
  status          TEXT NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started','on_track','at_risk','done','dropped')),
  marked_in       BIGINT REFERENCES reviews(id) ON DELETE SET NULL,
  result          TEXT CHECK (result IN ('met','partly','not_met','dropped')),
  result_comment  TEXT NOT NULL DEFAULT '' CHECK (length(result_comment) <= 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_goals_person_idx ON review_goals (person_id, goal_year);
CREATE INDEX IF NOT EXISTS review_goals_review_idx ON review_goals (review_id);
CREATE INDEX IF NOT EXISTS review_goals_marked_idx ON review_goals (marked_in);

CREATE TABLE IF NOT EXISTS review_goal_updates (
  id          BIGSERIAL PRIMARY KEY,
  goal_id     BIGINT NOT NULL REFERENCES review_goals(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES people(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('update','comment','checkin')),
  status      TEXT CHECK (status IN ('not_started','on_track','at_risk','done','dropped')),
  body        TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 4000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_goal_updates_goal_idx ON review_goal_updates (goal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_checkins (
  id                BIGSERIAL PRIMARY KEY,
  cycle_id          BIGINT NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  person_id         UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  manager_id        UUID REFERENCES people(id) ON DELETE SET NULL,
  event_id          UUID,
  starts_at         TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  UNIQUE (cycle_id, person_id)
);

-- ── Last year's files (first year only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_imports (
  id             BIGSERIAL PRIMARY KEY,
  year           INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  person_id      UUID REFERENCES people(id) ON DELETE CASCADE,
  drive_file_id  TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  mime_type      TEXT,
  web_link       TEXT,
  match          TEXT NOT NULL DEFAULT 'none' CHECK (match IN ('matched','check','none','skipped')),
  imported_at    TIMESTAMPTZ,
  imported_by    UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, drive_file_id)
);
CREATE INDEX IF NOT EXISTS review_imports_person_idx ON review_imports (person_id, year);

-- ── The log and the notices ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_log (
  id          BIGSERIAL PRIMARY KEY,
  cycle_id    BIGINT REFERENCES review_cycles(id) ON DELETE CASCADE,
  review_id   BIGINT REFERENCES reviews(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES people(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (length(kind) <= 60),
  text        TEXT NOT NULL CHECK (length(text) <= 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_log_cycle_idx ON review_log (cycle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_log_review_idx ON review_log (review_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_notices (
  key         TEXT PRIMARY KEY CHECK (length(key) <= 300),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Nothing for the anonymous or signed-in role ────────────────────────────
ALTER TABLE hr_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_priorities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_team_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_goal_updates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_checkins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_imports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_notices         ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_settings, review_cycles, review_priorities, review_team_priorities, reviews, review_answers,
              review_goals, review_goal_updates, review_checkins, review_imports, review_log, review_notices
  FROM anon, authenticated;
REVOKE ALL ON SEQUENCE review_cycles_id_seq, review_priorities_id_seq, reviews_id_seq, review_goals_id_seq,
                       review_goal_updates_id_seq, review_checkins_id_seq, review_imports_id_seq, review_log_id_seq
  FROM anon, authenticated;

-- ── The daily check (migrations 098, 113, 115, 139, 147) watches them too ──
CREATE OR REPLACE FUNCTION public.db_protections_check()
RETURNS TEXT[]
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(problem ORDER BY problem), '{}') FROM (
    SELECT 'people.' || c || ' readable by ' || r AS problem
      FROM unnest(ARRAY['internal_rate','monthly_salary','be_rate','address','date_of_birth','email_personal','phone']) c,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.people', c, 'SELECT')
    UNION ALL
    SELECT 'tr_assignments.hourly_rate readable by ' || r
      FROM unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.tr_assignments', 'hourly_rate', 'SELECT')
    UNION ALL
    SELECT t || ' readable by ' || r
      FROM unnest(ARRAY['monday_assignments','monday_assignment_events','monday_board_steps','monday_boards',
                        'monday_users','monday_user_links','monday_team_priority','monday_priority_grants',
                        'monday_snapshot','publishing_targets','publishing_target_periods','publishing_publishers',
                        'sites','pages','page_urls','confirmations','monday_events',
                        'app_settings','settings_change_log',
                        'tc_correction_requests','tc_combinations','tc_person_cadence',
                        'tc_pay_period_anchors','tc_safety_events',
                        'pay_terms','pay_terms_changes','tc_approval_events','invoices','invoice_lines',
                        'invoice_settings','reimbursement_documents','reimbursements','extra_hours_requests',
                        'integration_jobs','people_type_changes','agenda_events',
                        'agenda_accounts','agenda_person_settings','agenda_busy','agenda_event_guests',
                        'agenda_booking_links','agenda_bookings','agenda_account_tokens',
                        'reimbursement_reports','invoice_form_codes','invoice_form_submissions',
                        'hr_settings','review_cycles','review_priorities','review_team_priorities','reviews',
                        'review_answers','review_goals','review_goal_updates','review_checkins',
                        'review_imports','review_log','review_notices']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'SELECT')
    UNION ALL
    SELECT t || ' writable by ' || r
      FROM unnest(ARRAY['tc_entries','tc_submissions','tc_absence_requests','tc_entry_audit',
                        'tc_periods','tc_settings']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'INSERT')
        OR has_table_privilege(r, 'public.' || t, 'UPDATE')
        OR has_table_privilege(r, 'public.' || t, 'DELETE')
    UNION ALL
    SELECT f || ' callable by ' || r
      FROM unnest(ARRAY['merge_people(uuid,uuid)','merge_monday_links(uuid,uuid)','portal_can_sign_in(text)',
                        'portal_end_sessions(uuid)','portal_two_step_status(uuid)',
                        'monday_swap_board_assignments(bigint,uuid)','access_commit(jsonb,jsonb,jsonb)',
                        'set_person_teams(uuid,jsonb)',
                        'report_counted_events(bigint[])','report_span_events(bigint[],timestamptz)',
                        'report_open_since(bigint[])','report_flow_events(bigint[],timestamptz)',
                        'report_hours(uuid[],date)','report_jobcode_hours(integer[],date)',
                        'report_person_hours(uuid,date)',
                        'monday_write_board(bigint,uuid,jsonb)','monday_assignment_counts()',
                        'publishing_set_target(text,text,text,integer,text,date)',
                        'publishing_remove_target(uuid,text,date)',
                        'prune_monday_events()',
                        'my_work_list(bigint[],bigint[],bigint[],boolean,timestamptz,integer)',
                        'tc_job_field_defaults(date,text[])','next_document_number(text)',
                        'agenda_booking_hold(uuid,timestamptz,timestamptz,integer,text,text,text[],text,text,text,text,timestamptz)',
                        'agenda_booking_confirm(text,integer)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
