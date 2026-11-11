-- The i7 budget read in hours or in dollars (owner, 11 November 2026): each
-- person chooses on the i7 report, and Home's i7 widget follows the choice.
-- Null is the default, hours (the team works hours). Safe to run twice.

BEGIN;

ALTER TABLE person_settings ADD COLUMN IF NOT EXISTS i7_budget_view TEXT;
ALTER TABLE person_settings DROP CONSTRAINT IF EXISTS person_settings_i7_budget_view_check;
ALTER TABLE person_settings ADD CONSTRAINT person_settings_i7_budget_view_check CHECK (i7_budget_view IN ('hours', 'dollars'));

COMMIT;
