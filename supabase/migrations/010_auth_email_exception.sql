-- Allow a named admin email through the email-domain sign-in gate.
--
-- The portal restricts sign-in to @goodnewsadvocates.org, enforced in 3 layers:
-- client (LoginForm), server action (sendMagicLink), and this DB trigger on
-- auth.users. This adds arnaldo.oliveira@me.com as a single named exception so
-- he can sign in (and be auto-promoted to admin by handle_new_user, migration
-- 007), while everyone else still must use a goodnewsadvocates.org address.
--
-- Keep the allowlist here in sync with src/lib/auth-constants.ts.
--
-- ⚠️ BEFORE APPLYING — verify the live function body. enforce_email_domain()
-- was originally created via the Supabase dashboard, not in this folder, so the
-- body below is a reconstruction. If the live version does MORE than a domain
-- check, this CREATE OR REPLACE would drop that behavior. Dump the current
-- definition first and reconcile:
--
--     SELECT pg_get_functiondef('public.enforce_email_domain'::regproc);
--
-- The existing trigger on auth.users that calls this function keeps working —
-- CREATE OR REPLACE only swaps the function body, not the trigger.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.email ILIKE '%@goodnewsadvocates.org'
    OR LOWER(NEW.email) = 'arnaldo.oliveira@me.com'
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Email not allowed: % (must be a @goodnewsadvocates.org address)', NEW.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
