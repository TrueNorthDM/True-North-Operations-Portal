-- 095_access_positions_and_roles.sql
--
-- The second half of the access model (094), run once the new code is live,
-- because the code before it reads the old words.
--
--   1. Team positions become Lead and Member: Founder, Manager and Team Leader
--      are Lead; Collaborator is Member. The titles stay in each person's job
--      title.
--   2. The security role the database checks (profiles.role, is_admin()) follows
--      the given levels: Super Admin and Admin are 'admin', everyone else
--      'viewer'. What each of them may open is decided by the portal's access
--      rule; this only keeps the row-level policies in step.
--   3. The sign-up trigger applies the same mapping at a first sign-in.

BEGIN;

UPDATE team_members SET position = 'lead'   WHERE position IN ('founder', 'manager', 'team_leader');
UPDATE team_members SET position = 'member' WHERE position IS NULL OR position = 'collaborator';
ALTER TABLE team_members ALTER COLUMN position SET DEFAULT 'member';
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_position_chk;
ALTER TABLE team_members ADD CONSTRAINT team_members_position_chk CHECK (position IN ('lead', 'member'));

UPDATE profiles pr SET role = CASE WHEN p.access_level IN ('super_admin', 'admin') THEN 'admin' ELSE 'viewer' END
  FROM people p
 WHERE p.profile_id = pr.id;
UPDATE profiles pr SET role = 'admin'
 WHERE lower(pr.email) IN (SELECT lower(e) FROM people p,
         unnest(ARRAY[p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal]) e
        WHERE p.access_level IN ('super_admin', 'admin') AND e IS NOT NULL);
UPDATE profiles pr SET role = 'viewer'
 WHERE pr.role = 'admin'
   AND lower(pr.email) <> 'arnaldo.oliveira@me.com'
   AND NOT EXISTS (SELECT 1 FROM people p
                    WHERE p.access_level IN ('super_admin', 'admin')
                      AND (p.profile_id = pr.id
                           OR lower(pr.email) IN (lower(p.email_true_north), lower(p.email_goodnews),
                                                  lower(p.email_coe), lower(p.email_personal))));

-- 4. people.role_type mirrors the level, for every screen that shows it
--    ("Contact type"): Super Admin and Admin as given, else Team Leader when
--    Lead of any team, else User. Kept in step by triggers, so moving someone
--    between teams or positions moves their level with them.
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_role_type_check;
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_role_type_chk;

CREATE OR REPLACE FUNCTION public.access_level_of(p_person UUID)
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
           WHEN p.access_level IN ('super_admin', 'admin') THEN p.access_level
           WHEN EXISTS (SELECT 1 FROM team_members m WHERE m.person_id = p.id AND m.position = 'lead') THEN 'team_leader'
           ELSE 'user'
         END
    FROM people p WHERE p.id = p_person
$$;

CREATE OR REPLACE FUNCTION public.access_sync_role_type(p_person UUID)
RETURNS VOID LANGUAGE sql SET search_path = public AS $$
  UPDATE people SET role_type = access_level_of(p_person)
   WHERE id = p_person AND role_type IS DISTINCT FROM access_level_of(p_person)
$$;

CREATE OR REPLACE FUNCTION public.access_sync_from_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM access_sync_role_type(NEW.person_id); END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN PERFORM access_sync_role_type(OLD.person_id); END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS access_sync_members ON team_members;
CREATE TRIGGER access_sync_members AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION access_sync_from_members();

CREATE OR REPLACE FUNCTION public.access_sync_from_people()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.role_type := CASE
    WHEN NEW.access_level IN ('super_admin', 'admin') THEN NEW.access_level
    WHEN EXISTS (SELECT 1 FROM team_members m WHERE m.person_id = NEW.id AND m.position = 'lead') THEN 'team_leader'
    ELSE 'user'
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS access_sync_people ON people;
CREATE TRIGGER access_sync_people BEFORE INSERT OR UPDATE OF access_level, role_type ON people
  FOR EACH ROW EXECUTE FUNCTION access_sync_from_people();

UPDATE people SET role_type = access_level_of(id);
ALTER TABLE people ADD CONSTRAINT people_role_type_chk CHECK (role_type IN ('super_admin', 'admin', 'team_leader', 'user'));

-- 5. The sign-up trigger: the same mapping at a first sign-in.
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
    SELECT p.id,
           CASE WHEN p.access_level IN ('super_admin', 'admin') THEN 'admin' ELSE 'viewer' END
      INTO v_person_id, v_role
      FROM public.people p
     WHERE lower(p.email_goodnews) = lower(NEW.email)
        OR (lower(NEW.email) = 'arnaldo.oliveira@me.com'
            AND lower(NEW.email) IN (lower(p.email_true_north), lower(p.email_goodnews),
                                     lower(p.email_coe), lower(p.email_personal)))
     ORDER BY (p.status = 'inactive')
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
$$;

COMMIT;
