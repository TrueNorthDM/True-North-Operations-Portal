-- 050_first_login_applies_level.sql
--
-- Make the access level apply on its own at first sign-in.
--
-- handle_new_user created every profile with role='viewer' (bar one hardcoded
-- address), ignoring the level an admin had already assigned in the directory.
-- So a person set to Admin before they ever logged in arrived half-privileged:
-- the interface followed people.role_type and showed them everything, while the
-- gate followed profiles.role and rejected every write. Someone then had to
-- re-apply the level by hand.
--
-- Now the trigger reads the level the admin set, matching the login address
-- against any of the person's mailboxes, and creates the profile with the role
-- that level implies (admin/admin_assistant -> admin, the rest -> viewer). It
-- also fills people.profile_id, so the account is linked from the first login
-- instead of relying on email matching forever after.
--
-- Unmatched sign-ins (an allow-listed address with no directory record) still
-- land as 'viewer', which is the safe default.
--
-- The whole body stays inside an exception block, as before: a failure here
-- must never block the sign-up itself.
--
-- Depends on 007 (profiles, handle_new_user), 011 (hardened version),
-- 035 (people.role_type).

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_person_id UUID;
BEGIN
  BEGIN
    -- The directory record behind this login, by any of its mailboxes.
    -- Active records win when an address somehow appears twice.
    SELECT p.id,
           CASE WHEN p.role_type IN ('admin', 'admin_assistant') THEN 'admin' ELSE 'viewer' END
      INTO v_person_id, v_role
      FROM public.people p
     WHERE lower(NEW.email) IN (
             lower(p.email_true_north), lower(p.email_goodnews),
             lower(p.email_coe), lower(p.email_personal))
     ORDER BY (p.status = 'inactive')   -- false first, so active records win
     LIMIT 1;

    -- The founding account keeps its floor regardless of the directory.
    IF lower(NEW.email) = 'arnaldo.oliveira@me.com' THEN
      v_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(v_role, 'viewer'))
    ON CONFLICT (id) DO NOTHING;

    -- Link the directory record to the account, once, here.
    IF v_person_id IS NOT NULL THEN
      UPDATE public.people
         SET profile_id = NEW.id
       WHERE id = v_person_id
         AND profile_id IS NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: could not create profile for %: %', NEW.email, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

COMMIT;
