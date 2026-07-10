-- Allow @truenorthdigitalmarketing.com through the email-domain sign-in gate.
--
-- Sign-in is restricted in 3 layers: client (LoginForm), server action
-- (sendMagicLink), and this DB trigger on auth.users. This widens the DB gate
-- to accept BOTH @goodnewsadvocates.org and @truenorthdigitalmarketing.com,
-- plus the named admin exception (arnaldo.oliveira@me.com, auto-promoted to
-- admin by handle_new_user, migration 007).
--
-- Keep the allowlist here in sync with src/lib/auth-constants.ts
-- (ALLOWED_EMAIL_DOMAINS + ALLOWED_EMAILS).
--
-- ⚠️ BEFORE APPLYING — verify the live function body. enforce_email_domain()
-- was originally created via the Supabase dashboard, so dump the current
-- definition and reconcile if it does more than a domain check:
--
--     SELECT pg_get_functiondef('public.enforce_email_domain'::regproc);
--
-- CREATE OR REPLACE only swaps the function body; the existing trigger on
-- auth.users that calls it keeps working.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.email ILIKE '%@goodnewsadvocates.org'
    OR NEW.email ILIKE '%@truenorthdigitalmarketing.com'
    OR LOWER(NEW.email) = 'arnaldo.oliveira@me.com'
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Email not allowed: % (must be a @goodnewsadvocates.org or @truenorthdigitalmarketing.com address)', NEW.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
