-- Time off, the three kinds Rippling has (owner, 9 November 2026): Vacation,
-- Sick Leave and Unpaid Time Off. Vacation and Sick are already job codes; this
-- adds Unpaid Time Off, made in the portal as "Other" was (no TSheets id), so
-- the TSheets import never touches it. Jury duty and Other stay in the
-- catalogue for the requests already made; the portal no longer offers them
-- (lib/timeclock/time-off-data.ts NOT_ASKED). Safe to run twice.

BEGIN;

INSERT INTO tc_jobcodes (name, kind, billable, active, folder, structure, edited_in_portal_at)
SELECT 'Unpaid Time Off', 'unpaid', false, true, false, 1, now()
WHERE NOT EXISTS (SELECT 1 FROM tc_jobcodes WHERE lower(name) = 'unpaid time off' AND kind = 'unpaid');

COMMIT;
