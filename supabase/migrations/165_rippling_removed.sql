-- Rippling is not connected (owner, 11 November 2026): its API is not in the
-- company's plan and it has no hours import, so Rippling stays the payroll and
-- Finance enters approved hours and time off there from a portal report. This
-- takes out what the portal kept for the connection: the token, the per-request
-- and per-period sending state, the worker link, and the outbox's Rippling jobs
-- (none was ever sent: production never held a token). Safe to run twice.
-- Run it only after the code that no longer reads these columns is live.

BEGIN;

DELETE FROM integration_jobs WHERE kind LIKE 'rippling%';
ALTER TABLE integration_jobs DROP CONSTRAINT IF EXISTS integration_jobs_kind_check;
ALTER TABLE integration_jobs ADD CONSTRAINT integration_jobs_kind_check CHECK (kind IN ('gcal_upsert', 'gcal_delete'));

ALTER TABLE people DROP COLUMN IF EXISTS rippling_worker_id;
ALTER TABLE tc_submissions DROP COLUMN IF EXISTS rippling_entries;
ALTER TABLE tc_absence_requests
  DROP COLUMN IF EXISTS rippling_request_ids,
  DROP COLUMN IF EXISTS rippling_state,
  DROP COLUMN IF EXISTS rippling_error,
  DROP COLUMN IF EXISTS rippling_sent_at;
ALTER TABLE app_settings
  DROP COLUMN IF EXISTS rippling_api_token,
  DROP COLUMN IF EXISTS rippling_connected_as,
  DROP COLUMN IF EXISTS rippling_checked_at,
  DROP COLUMN IF EXISTS rippling_connected_by,
  DROP COLUMN IF EXISTS rippling_connected_at;

COMMIT;
