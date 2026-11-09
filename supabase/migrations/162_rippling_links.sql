-- Rippling (owner, 9 November 2026): the portal sends each US employee's
-- approved hours (one total a day) and approved time off to Rippling through
-- its API. What it needs to remember, on tables that already exist:
--
--   people.rippling_worker_id          the person's Rippling worker (role) id,
--                                      matched by work email
--   tc_absence_requests.rippling_request_ids
--                                      the leave requests made for it, one a
--                                      day, so a cancellation cancels them
--   tc_submissions.rippling_entries    the time entries sent for a pay period,
--                                      {"YYYY-MM-DD": {"id": "...", "hours": 8}},
--                                      so sending again changes them instead
--                                      of adding new ones
--
-- No new table, so the daily protections check needs no change. Safe to run twice.

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS rippling_worker_id TEXT;
ALTER TABLE tc_absence_requests ADD COLUMN IF NOT EXISTS rippling_request_ids TEXT[];
ALTER TABLE tc_submissions ADD COLUMN IF NOT EXISTS rippling_entries JSONB;

COMMIT;
