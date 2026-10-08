-- 098_restore_database_protections.sql
--
-- Restores what earlier migrations had closed, found open again on
-- 8 October 2026 (audit, module 4), most likely when the database moved to
-- the portal's own server (5 October) and the platform's default grants came
-- back with it:
--
--   054, 078   pay: people.internal_rate, monthly_salary, be_rate and
--              tr_assignments.hourly_rate, readable by any signed-in session
--   056        contact: people.address, date_of_birth, email_personal, phone
--   063, 064,  six functions meant for the server alone, callable by anyone
--   089, 090,  signed in and by the anonymous role: merge_people,
--   091        merge_monday_links, portal_can_sign_in, portal_end_sessions,
--              portal_two_step_status, monday_swap_board_assignments
--
-- Nothing leaked: the database gate (deploy/portal/db-gate.sh) refuses every
-- request without the server's key, and the session cookies are httpOnly. This
-- puts the database's own layer back, so the gate is no longer the only one.
--
-- The portal reads all of the above with the privileged client already (the
-- code was checked before writing this), so no screen changes.
--
-- It also adds db_protections_check(), a read-only answer to "are these still
-- closed?", so a future move or restore that reopens them is noticed.

BEGIN;

-- ── people: every column but pay and contact ────────────────────────────────
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'people'
     AND column_name NOT IN (
       'internal_rate', 'monthly_salary', 'be_rate',                 -- pay (054, 078)
       'address', 'date_of_birth', 'email_personal', 'phone'          -- contact (056)
     );
  EXECUTE 'REVOKE SELECT ON public.people FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.people TO authenticated', cols);
END $$;

-- ── tr_assignments: every column but the rate ───────────────────────────────
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'tr_assignments'
     AND column_name NOT IN ('hourly_rate');                          -- pay (054)
  EXECUTE 'REVOKE SELECT ON public.tr_assignments FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.tr_assignments TO authenticated', cols);
END $$;

-- The anonymous role has no business with either table (no policy lets it
-- read a row; this removes the grants too).
REVOKE ALL ON public.people FROM anon;
REVOKE ALL ON public.tr_assignments FROM anon;

-- ── Functions for the server alone ──────────────────────────────────────────
REVOKE ALL ON FUNCTION public.merge_people(uuid, uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.merge_monday_links(uuid, uuid)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_can_sign_in(text)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_end_sessions(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_two_step_status(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.monday_swap_board_assignments(bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_monday_links(uuid, uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_can_sign_in(text)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_end_sessions(uuid)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_two_step_status(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.monday_swap_board_assignments(bigint, uuid) TO service_role;

-- ── The check: every protection above, as one list of what is open ──────────
CREATE OR REPLACE FUNCTION public.db_protections_check()
RETURNS TEXT[]
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(problem ORDER BY problem), '{}') FROM (
    SELECT 'people.' || c || ' readable by ' || r AS problem
      FROM unnest(ARRAY['internal_rate','monthly_salary','be_rate','address','date_of_birth','email_personal','phone']) c,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.people', c, 'SELECT')
    UNION ALL
    SELECT 'tr_assignments.hourly_rate readable by ' || r
      FROM unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.tr_assignments', 'hourly_rate', 'SELECT')
    UNION ALL
    SELECT f || ' callable by ' || r
      FROM unnest(ARRAY['merge_people(uuid,uuid)','merge_monday_links(uuid,uuid)','portal_can_sign_in(text)',
                        'portal_end_sessions(uuid)','portal_two_step_status(uuid)',
                        'monday_swap_board_assignments(bigint,uuid)','access_commit(jsonb,jsonb,jsonb)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;
REVOKE ALL ON FUNCTION public.db_protections_check() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.db_protections_check() TO service_role;

COMMIT;

-- The API reads the grants it may serve from its schema cache.
NOTIFY pgrst, 'reload schema';

-- Expect an empty list:
SELECT db_protections_check();
