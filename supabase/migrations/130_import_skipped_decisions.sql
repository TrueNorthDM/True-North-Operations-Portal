-- 130_import_skipped_decisions.sql
--
-- The decision on a TSheets entry set aside after its person's North Time
-- start date (tc_import_skipped, migration 129). "Count it" writes the hours
-- to tc_entries; "Discard it" writes nothing. Migration 129 already has who,
-- when and the choice (decided_by, decided_at, decision: 'imported' = counted,
-- 'dismissed' = discarded). This adds:
--
--   decision_reason    why: required when counting the entry puts the person
--                      past their allowance, optional otherwise
--   counted_entry_id   the tc_entries row a counted entry became (emptied if
--                      that row is deleted later)
--
-- and an index for the undecided ones (the badge on Company settings counts
-- them on every visit).
--
-- Server only, like the rest of the table. Safe to run more than once.

BEGIN;

ALTER TABLE tc_import_skipped ADD COLUMN IF NOT EXISTS decision_reason  TEXT;
ALTER TABLE tc_import_skipped ADD COLUMN IF NOT EXISTS counted_entry_id BIGINT REFERENCES tc_entries(id) ON DELETE SET NULL;

-- A decided row always says who and how; an undecided one says neither.
ALTER TABLE tc_import_skipped DROP CONSTRAINT IF EXISTS tc_import_skipped_decided_whole;
ALTER TABLE tc_import_skipped ADD CONSTRAINT tc_import_skipped_decided_whole
  CHECK ((decided_at IS NULL) = (decision IS NULL));

CREATE INDEX IF NOT EXISTS tc_import_skipped_undecided ON tc_import_skipped (entry_date) WHERE decided_at IS NULL;

COMMIT;
