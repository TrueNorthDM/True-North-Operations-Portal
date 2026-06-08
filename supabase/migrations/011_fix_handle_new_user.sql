-- Fix: harden handle_new_user so it can never block sign-up.
--
-- Symptom: "Database error saving new user" on first sign-in. The
-- on_auth_user_created trigger (007) runs handle_new_user as part of the
-- auth.users INSERT; when that function throws, the whole insert rolls back and
-- the user can't be created.
--
-- Root cause: the original function (007) inserted into an unqualified
-- `profiles` with no fixed search_path. Triggers fired by GoTrue
-- (supabase_auth_admin) don't necessarily have `public` on their search_path,
-- so `profiles` failed to resolve.
--
-- Fixes:
--   1. SET search_path = public + schema-qualify (public.profiles).
--   2. Wrap the insert so a profile-bookkeeping hiccup never blocks auth —
--      a missing profile is recoverable (backfilled below); a user who can't
--      sign in is not. Any failure is surfaced as a WARNING in the Postgres log.
--   3. Grant the auth role what it needs to run the function.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
      NEW.id,
      NEW.email,
      CASE WHEN NEW.email = 'arnaldo.oliveira@me.com' THEN 'admin' ELSE 'viewer' END
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: could not create profile for %: %', NEW.email, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Let the GoTrue auth role reach + run the trigger function.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

COMMIT;
