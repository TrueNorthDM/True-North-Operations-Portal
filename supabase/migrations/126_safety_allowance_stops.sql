-- Allowance stops on the Clock safety page (owner's plan, 27 October 2026).
-- Since 25 October a running clock stops by itself when the person reaches
-- their hours allowance (src/lib/timeclock/allowance-limit.ts). Those stops
-- now go into tc_safety_events beside the 5-hour automatic clock-outs, so the
-- Clock safety page lists them with their own reason ("Allowance reached").
--
-- 1. kind accepts 'limit_stop'. For a limit_stop row, window_started_at holds
--    the start of the clock that was stopped (each clock reaches the limit
--    once), stopped_at where it stopped, and there is no end to confirm.
-- 2. allowance: the allowance it reached, as the history line names it
--    ("140h 00m allowance for October"). limit_stop rows only.
--
-- Idempotent. The code works without it: the insert fails, is logged, and the
-- clock still stops.

BEGIN;

ALTER TABLE tc_safety_events DROP CONSTRAINT IF EXISTS tc_safety_events_kind_check;
ALTER TABLE tc_safety_events ADD CONSTRAINT tc_safety_events_kind_check
  CHECK (kind IN ('warned', 'keep_going', 'auto_stop', 'limit_stop'));

ALTER TABLE tc_safety_events ADD COLUMN IF NOT EXISTS allowance TEXT;

COMMIT;
