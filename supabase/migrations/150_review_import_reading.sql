-- 150_review_import_reading.sql
--
-- The first year's goals come from last year's Word files (the owner, 4
-- November 2026). On import the portal reads each file's text and keeps what
-- it found: the goals set for the year under review become that person's
-- goals of the year (locked in their review, only marked there), and the Job
-- Description answers wait for "Copy from your 2025 review". HR checks and
-- corrects both on the import screen before the cycle starts.
--
--   review_imports.found      what was read: { job: { job_current: "...", ... },
--                             goals: n, read: true|false } (false: a PDF, or
--                             no text could be read)
--   review_goals.import_id    the file a goal came from; it goes when the file
--                             is imported again or removed

ALTER TABLE review_imports ADD COLUMN IF NOT EXISTS found JSONB;
ALTER TABLE review_goals ADD COLUMN IF NOT EXISTS import_id BIGINT REFERENCES review_imports(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS review_goals_import_idx ON review_goals (import_id) WHERE import_id IS NOT NULL;
