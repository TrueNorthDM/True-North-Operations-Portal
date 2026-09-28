-- 089_portal_invites.sql
--
-- Sign-in by invitation (migration plan, step p4-invite).
--
-- Until now anyone with a @goodnewsadvocates.org or @truenorthdigitalmarketing.com
-- address could create an account. From here, a person signs in only when all of
-- this holds:
--
--   * the address is their GoodNews mailbox in the Directory (people.email_goodnews),
--     one address per person, so nobody ends up with two accounts;
--   * they are active in the Directory;
--   * an admin has invited them (people.portal_invited_at).
--
-- The one exception is the founding account, arnaldo.oliveira@me.com, which can
-- always sign in. Two-step sign-in (step p4-2fa) applies to it like to everyone.
--
-- The rule lives in ONE function, portal_can_sign_in, used by:
--   * the sign-in server action (src/app/auth/actions.ts), before a link is sent;
--   * the trigger on auth.users (enforce_email_domain), so no account can be
--     created around the app, including through Google sign-in later;
--   * the page gate (src/lib/auth/portal-access.ts) mirrors it for sessions that
--     already exist, so deactivating someone closes their access on the next page.
--
-- Also here: handle_new_user links an account through the GoodNews mailbox, the
-- people who already sign in are invited, and portal_end_sessions lets the app end
-- someone's sessions the moment they are deactivated or their invitation revoked.
--
-- Depends on 050 (handle_new_user), 028 (enforce_email_domain).

BEGIN;

-- 1. The invitation ----------------------------------------------------------

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_invited_by uuid;

COMMENT ON COLUMN public.people.portal_invited_at IS
  'When an admin invited this person to the portal. NULL = not invited, cannot sign in.';

-- people is read column by column since migration 054, so a new column is
-- invisible to the signed-in role until granted. The Directory shows who is
-- invited; who did the inviting stays a service-role read.
GRANT SELECT (portal_invited_at) ON public.people TO authenticated;

-- 2. The rule -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_can_sign_in(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p_email, ''))) = 'arnaldo.oliveira@me.com'
      OR EXISTS (
           SELECT 1
             FROM public.people p
            WHERE lower(p.email_goodnews) = lower(trim(p_email))
              AND lower(p.email_goodnews) LIKE '%@goodnewsadvocates.org'
              AND coalesce(p.status, 'active') <> 'inactive'
              AND p.portal_invited_at IS NOT NULL
         );
$$;

-- Nobody signed in, and nobody anonymous, may ask who is invited.
REVOKE ALL ON FUNCTION public.portal_can_sign_in(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_can_sign_in(text) TO service_role, supabase_auth_admin;

-- 3. The database gate: no account is created for anyone else -----------------

CREATE OR REPLACE FUNCTION public.enforce_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.portal_can_sign_in(NEW.email) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Email not invited: % (sign in with the GoodNews address an admin invited)', NEW.email;
END;
$$;

-- 4. Linking an account to its person ------------------------------------------

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
    -- The directory record behind this login: by the GoodNews mailbox, which is
    -- the only address that can sign in; the founding account by any mailbox.
    SELECT p.id,
           CASE WHEN p.role_type IN ('admin', 'admin_assistant') THEN 'admin' ELSE 'viewer' END
      INTO v_person_id, v_role
      FROM public.people p
     WHERE lower(p.email_goodnews) = lower(NEW.email)
        OR (lower(NEW.email) = 'arnaldo.oliveira@me.com'
            AND lower(NEW.email) IN (lower(p.email_true_north), lower(p.email_goodnews),
                                     lower(p.email_coe), lower(p.email_personal)))
     ORDER BY (p.status = 'inactive')   -- active records first
     LIMIT 1;

    -- The founding account keeps its floor regardless of the directory.
    IF lower(NEW.email) = 'arnaldo.oliveira@me.com' THEN
      v_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(v_role, 'viewer'))
    ON CONFLICT (id) DO NOTHING;

    -- Link the directory record to the account. Also when the record still
    -- points at an account that no longer exists.
    IF v_person_id IS NOT NULL THEN
      UPDATE public.people p
         SET profile_id = NEW.id
       WHERE p.id = v_person_id
         AND (p.profile_id IS NULL
              OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.profile_id));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: could not create profile for %: %', NEW.email, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.enforce_email_domain() TO supabase_auth_admin;

-- 5. Ending someone's sessions ----------------------------------------------------

-- Called by the app (service role) when a person is deactivated, removed or has
-- the invitation revoked. Their refresh tokens go with the sessions (cascade), and
-- the Auth server refuses the remaining access token on every write.
CREATE OR REPLACE FUNCTION public.portal_end_sessions(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM auth.sessions WHERE user_id = p_user;
$$;

REVOKE ALL ON FUNCTION public.portal_end_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_end_sessions(uuid) TO service_role;

-- 6. Nobody who signs in today is locked out -----------------------------------

-- Accounts on a GoodNews address that were never linked to their person.
UPDATE public.people p
   SET profile_id = u.id
  FROM auth.users u
 WHERE p.profile_id IS NULL
   AND lower(u.email) = lower(p.email_goodnews)
   AND NOT EXISTS (SELECT 1 FROM public.people q WHERE q.profile_id = u.id);

-- The founding account, linked through whichever mailbox holds it.
UPDATE public.people p
   SET profile_id = u.id
  FROM auth.users u
 WHERE p.profile_id IS NULL
   AND lower(u.email) = 'arnaldo.oliveira@me.com'
   AND lower(u.email) IN (lower(p.email_true_north), lower(p.email_goodnews),
                          lower(p.email_coe), lower(p.email_personal))
   AND NOT EXISTS (SELECT 1 FROM public.people q WHERE q.profile_id = u.id);

-- Everyone active who already has an account is invited.
UPDATE public.people
   SET portal_invited_at = now()
 WHERE portal_invited_at IS NULL
   AND profile_id IS NOT NULL
   AND coalesce(status, 'active') <> 'inactive';

COMMIT;
