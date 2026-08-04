-- 054_pay_columns_off_limits.sql
--
-- Takes pay out of reach of the `authenticated` role.
--
-- THE GAP. RLS decides which ROWS a session sees and has nothing to say about
-- columns. people_read (migration 014) and the tr_* read policies grant SELECT
-- with USING (true), and `authenticated` is one role shared by an admin and a
-- first-week hire. The Directory itself is built correctly: at levels 1 and 2 it
-- ships a RestrictedPerson with no rate on it, so nothing sensitive reaches the
-- browser through the page. But the page was never the only door:
--
--   GET /rest/v1/people?select=full_name,monthly_salary,internal_rate
--   GET /rest/v1/tr_assignments?select=tsheets_user_id,hourly_rate
--   GET /rest/v1/tr_audit_log?select=before_data,after_data
--
-- with the public anon key out of the JS bundle and the reader's own session
-- token out of localStorage. That is devtools, not an exploit.
--
-- THE FIX is column privileges, the one mechanism that understands columns.
-- After this, no session reads pay: not a low-privilege account, not a leaked
-- token, not an admin's own browser. The service_role client still can, and
-- src/lib/hr/compensation.ts is the single place that does, called only from
-- paths already behind directory level 3, requireSurface or requireAdmin.
--
-- tr_audit_log is included because it records the old and new values of every
-- rate and salary change in before_data/after_data. Locking the columns while
-- leaving their history readable would have been theatre.
--
-- ⚠ OPERATIONAL FOOTGUN, READ THIS BEFORE ADDING A COLUMN TO people OR
-- tr_assignments. A column grant lists columns explicitly, so any column added
-- later is NOT readable by `authenticated` until it is granted. PostgREST drops
-- the WHOLE query on a permission error, so the symptom is a screen going blank
-- rather than one field going missing (the same failure the migration-029
-- comment in budget-usage-data.ts describes). After adding a column, either run
-- the matching GRANT or re-run this migration, which recomputes the list.
-- Failing closed is the right default here; being surprised by it is not.
--
-- Verify afterwards, signed in as a NON-admin, with that session's token:
--   curl "$URL/rest/v1/people?select=monthly_salary" -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT"
-- Expect 403 "permission denied for column", not a list of numbers.

-- ─── people: everything except pay ───────────────────────────────────────────
-- Built from information_schema rather than typed out, so the list cannot drift
-- from the real table and a re-run picks up whatever columns exist that day.

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'people'
     AND column_name NOT IN ('internal_rate', 'monthly_salary');

  EXECUTE 'REVOKE SELECT ON public.people FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.people TO authenticated', cols);
END $$;

-- ─── tr_assignments: everything except the billing rate ──────────────────────

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'tr_assignments'
     AND column_name NOT IN ('hourly_rate');

  EXECUTE 'REVOKE SELECT ON public.tr_assignments FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.tr_assignments TO authenticated', cols);
END $$;

-- ─── tr_audit_log: admin-only, because it repeats the numbers ────────────────
-- The read policy from 051 was open to every authenticated user. Nothing reads
-- this with a user session any more; the Settings and Directory history tabs go
-- through loadAuditLog() on the service_role client.

DROP POLICY IF EXISTS tr_audit_log_read ON tr_audit_log;
CREATE POLICY tr_audit_log_read ON tr_audit_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
