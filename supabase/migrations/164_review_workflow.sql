-- 164: the annual review's new workflow (owner, 10 November 2026; docs/annual-review/01-workflow-2026-11.md).
--
-- 1. The year's dates come from the kickoff: the CISO's Company Priorities, the VP of Operations'
--    priorities, and separate meeting and approval dates for the leaders' lane (the people with no
--    Team Leader). company_done_at / vp_done_at: the two marked their priorities ready.
-- 2. The 6-month check-in: started by the VP, the priorities checked with the CISO, everyone told,
--    with its own due dates.
-- 3. Priorities have a kind: the CISO's Company Priorities, the VP's, or a team's. At the check-in
--    each one is kept, changed (with what and why) or added.
-- 4. Two reviewers: a second reviewer's part of a review (review_parts), their answers (part 1),
--    the goals for them (review_goals.part), and their check-in (review_checkins.part).
-- 5. reviews.approved_seen_at: the person read the "approved" window on Home.
-- 6. hr_settings.second_reviewers: the second reviewers set by hand, over the rule worked out from
--    the teams ({ "<person id>": { "reviewerId": "<id>", "area": "SEO" } or false for none).
--
-- review_parts gets nothing for the signed-in role, like the other review tables (148). It is not
-- added to db_protections_check here: production runs an older copy of that function (158 is on
-- staging only), and redefining it from here would name tables production does not have.

BEGIN;

ALTER TABLE review_cycles
  ADD COLUMN IF NOT EXISTS company_due          DATE,
  ADD COLUMN IF NOT EXISTS vp_due               DATE,
  ADD COLUMN IF NOT EXISTS leaders_meeting_due  DATE,
  ADD COLUMN IF NOT EXISTS leaders_approval_due DATE,
  ADD COLUMN IF NOT EXISTS company_done_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vp_done_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_started_by   UUID REFERENCES people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkin_told_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ck_priorities_due    DATE,
  ADD COLUMN IF NOT EXISTS ck_book_due          DATE,
  ADD COLUMN IF NOT EXISTS ck_done_due          DATE;

ALTER TABLE review_priorities
  ADD COLUMN IF NOT EXISTS kind       TEXT NOT NULL DEFAULT 'company' CHECK (kind IN ('company','vp','team')),
  ADD COLUMN IF NOT EXISTS mid_status TEXT CHECK (mid_status IN ('same','changed','added')),
  ADD COLUMN IF NOT EXISTS mid_note   TEXT NOT NULL DEFAULT '' CHECK (length(mid_note) <= 2000),
  ADD COLUMN IF NOT EXISTS mid_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mid_by     UUID REFERENCES people(id) ON DELETE SET NULL;
UPDATE review_priorities SET kind = 'team' WHERE team_id IS NOT NULL AND kind <> 'team';

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS review_parts (
  id                 BIGSERIAL PRIMARY KEY,
  review_id          BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  part               SMALLINT NOT NULL DEFAULT 1 CHECK (part = 1),
  reviewer_id        UUID REFERENCES people(id) ON DELETE SET NULL,
  area               TEXT NOT NULL DEFAULT '' CHECK (length(area) <= 120),
  step               TEXT NOT NULL DEFAULT 'waiting' CHECK (step IN ('waiting','review','meeting','approval','approved')),
  review_sent_at     TIMESTAMPTZ,
  meeting_event_id   BIGINT,
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
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, part)
);
CREATE INDEX IF NOT EXISTS review_parts_reviewer_idx ON review_parts (reviewer_id, step);

ALTER TABLE review_answers ADD COLUMN IF NOT EXISTS part SMALLINT NOT NULL DEFAULT 0 CHECK (part IN (0, 1));
ALTER TABLE review_answers DROP CONSTRAINT IF EXISTS review_answers_pkey;
ALTER TABLE review_answers ADD CONSTRAINT review_answers_pkey PRIMARY KEY (review_id, key, part);

ALTER TABLE review_goals ADD COLUMN IF NOT EXISTS part SMALLINT CHECK (part IN (0, 1));

ALTER TABLE review_checkins
  ADD COLUMN IF NOT EXISTS part         SMALLINT NOT NULL DEFAULT 0 CHECK (part IN (0, 1)),
  ADD COLUMN IF NOT EXISTS person_note  TEXT NOT NULL DEFAULT '' CHECK (length(person_note) <= 4000),
  ADD COLUMN IF NOT EXISTS manager_note TEXT NOT NULL DEFAULT '' CHECK (length(manager_note) <= 4000);
ALTER TABLE review_checkins DROP CONSTRAINT IF EXISTS review_checkins_cycle_id_person_id_key;
ALTER TABLE review_checkins DROP CONSTRAINT IF EXISTS review_checkins_cycle_person_part_key;
ALTER TABLE review_checkins ADD CONSTRAINT review_checkins_cycle_person_part_key UNIQUE (cycle_id, person_id, part);

ALTER TABLE hr_settings ADD COLUMN IF NOT EXISTS second_reviewers JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE review_parts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON review_parts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE review_parts_id_seq FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
