-- 039_person_monthly_salary.sql
--
-- Optional fixed MONTHLY cost per person (people.monthly_salary), for staff paid
-- a flat monthly amount rather than (or alongside) the hourly cost rate
-- (people.internal_rate). Shown + edited in the Directory's Rates & Costs tab
-- ("Month / salary" column). Null = not set.
--
-- Depends on 014 (people).

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS monthly_salary numeric;

COMMIT;
