-- Hours limit by pay period (owner, 9 November 2026, mockup "Hours Limit by
-- Pay Period"): a contractor's hours limit covers their pay period. The Work
-- tab's Hours limit is a number per week or per month:
--
--   people.hours_limit_per          'week' (the number in people.weekly_hours
--                                   is hours a week, as until now) or 'month'
--                                   (it holds hours a month)
--   extra_hours_requests.period     may also be 'pay_period': extra hours are
--                                   asked for the person's own window, and for
--                                   someone paid every 2 weeks that is the pay
--                                   period (period_start / period_end are its
--                                   14 days)
--
-- The window and the hours it allows are worked out in the portal
-- (lib/timeclock/allowance.ts allowanceFor), from this and how the person
-- submits (tc_person_cadence) and the company's pay period starts.
--
-- No data changes: everyone stays 'week'. Safe to run twice.

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS hours_limit_per TEXT NOT NULL DEFAULT 'week';
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_hours_limit_per_check;
ALTER TABLE people ADD CONSTRAINT people_hours_limit_per_check CHECK (hours_limit_per IN ('week', 'month'));

COMMENT ON COLUMN people.hours_limit_per IS
  'What people.weekly_hours is per for a contractor''s hours limit: week (hours a week) or month (hours a month).';

-- people is read column by column since migration 054 (098 restored it), so a
-- new column is invisible to the signed-in role until granted. It sits beside
-- weekly_hours, which that role reads; neither is pay.
GRANT SELECT (hours_limit_per) ON public.people TO authenticated;

ALTER TABLE extra_hours_requests DROP CONSTRAINT IF EXISTS extra_hours_requests_period_check;
ALTER TABLE extra_hours_requests ADD CONSTRAINT extra_hours_requests_period_check CHECK (period IN ('week', 'month', 'pay_period'));

COMMIT;
