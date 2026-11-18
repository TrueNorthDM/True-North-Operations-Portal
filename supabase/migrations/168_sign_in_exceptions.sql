-- Sign-in exceptions (owner, 18 November 2026): a person signs in with their
-- GoodNews address, and nothing else, unless a Super Admin lists another
-- address for them here (Directory > Portal access). Not everyone has a
-- GoodNews mailbox: some have a True North one only, some a personal one.
-- Until now the one exception was the founding account, written into the code
-- and into the two functions below; it stays there as a safety net and is
-- also listed here, so the list shows every exception there is.
--
-- An exception belongs to one person and opens nothing by itself: the person
-- must still be active and invited (portal_can_sign_in). One address serves
-- one person. Read and written by the server only. Safe to run twice.

BEGIN;

CREATE TABLE IF NOT EXISTS portal_sign_in_exceptions (
  person_id  UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  email      TEXT NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  added_by   UUID REFERENCES people(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_sign_in_exceptions_email ON portal_sign_in_exceptions (email);

ALTER TABLE portal_sign_in_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON portal_sign_in_exceptions FROM anon, authenticated;

-- The founding account, listed like any other exception.
INSERT INTO portal_sign_in_exceptions (person_id, email)
SELECT p.id, 'arnaldo.oliveira@me.com'
  FROM people p
 WHERE 'arnaldo.oliveira@me.com' IN (lower(p.email_true_north), lower(p.email_goodnews), lower(p.email_coe), lower(p.email_personal))
 ORDER BY (p.status = 'inactive')
 LIMIT 1
ON CONFLICT DO NOTHING;

-- May this address be sent a sign-in code: the GoodNews mailbox of an active,
-- invited person, or the address listed as that person's exception.
CREATE OR REPLACE FUNCTION public.portal_can_sign_in(p_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT lower(trim(coalesce(p_email, ''))) = 'arnaldo.oliveira@me.com'
      OR EXISTS (
           SELECT 1
             FROM public.people p
            WHERE lower(p.email_goodnews) = lower(trim(p_email))
              AND lower(p.email_goodnews) LIKE '%@goodnewsadvocates.org'
              AND coalesce(p.status, 'active') <> 'inactive'
              AND p.portal_invited_at IS NOT NULL
         )
      OR EXISTS (
           SELECT 1
             FROM public.portal_sign_in_exceptions x
             JOIN public.people p ON p.id = x.person_id
            WHERE x.email = lower(trim(p_email))
              AND coalesce(p.status, 'active') <> 'inactive'
              AND p.portal_invited_at IS NOT NULL
         );
$function$;
REVOKE ALL ON FUNCTION public.portal_can_sign_in(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_can_sign_in(text) TO service_role;

-- A new account is tied to its person: by the exception first (it names the
-- person outright), else by the GoodNews mailbox, else the founding account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_person_id UUID;
BEGIN
  BEGIN
    SELECT p.id,
           CASE WHEN p.access_level IN ('super_admin', 'admin') THEN 'admin' ELSE 'viewer' END
      INTO v_person_id, v_role
      FROM public.people p
      LEFT JOIN public.portal_sign_in_exceptions x ON x.person_id = p.id
     WHERE x.email = lower(NEW.email)
        OR lower(p.email_goodnews) = lower(NEW.email)
        OR (lower(NEW.email) = 'arnaldo.oliveira@me.com'
            AND lower(NEW.email) IN (lower(p.email_true_north), lower(p.email_goodnews),
                                     lower(p.email_coe), lower(p.email_personal)))
     ORDER BY (x.email = lower(NEW.email)) DESC NULLS LAST, (p.status = 'inactive')
     LIMIT 1;

    IF lower(NEW.email) = 'arnaldo.oliveira@me.com' THEN
      v_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(v_role, 'viewer'))
    ON CONFLICT (id) DO NOTHING;

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
$function$;

-- The daily check watches the new table too. The check's list differs by
-- database (staging also watches the Topic Studio tables), so the table is
-- added to the function as each database has it, not written out again here.
DO $do$
DECLARE
  def TEXT := pg_get_functiondef('public.db_protections_check()'::regprocedure);
BEGIN
  IF position('''portal_sign_in_exceptions''' IN def) = 0 THEN
    IF position('''agenda_zoom_accounts''' IN def) = 0 THEN
      RAISE EXCEPTION 'db_protections_check has no agenda_zoom_accounts to add after: run migration 167 first';
    END IF;
    EXECUTE replace(def, '''agenda_zoom_accounts''', '''agenda_zoom_accounts'',''portal_sign_in_exceptions''');
  END IF;
END
$do$;

COMMIT;
