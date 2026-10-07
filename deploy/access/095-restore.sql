-- Undo migration 095 from the snapshot 095-snapshot.sql took just before it.
-- Only for rolling the code back past the access model AFTER 095 ran
-- (deploy/access/README.md). One transaction: all of it or nothing.

BEGIN;

DROP TRIGGER IF EXISTS access_sync_members ON public.team_members;
DROP TRIGGER IF EXISTS access_sync_people ON public.people;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_position_chk;
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_type_chk;
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_role_type_check;

-- Rows that existed before 095 get their old values back.
UPDATE public.team_members t SET position = u.position
  FROM undo_095.members u WHERE u.team_id = t.team_id AND u.person_id = t.person_id;
UPDATE public.profiles p SET role = u.role FROM undo_095.profiles u WHERE u.id = p.id;
UPDATE public.people p SET role_type = u.role_type FROM undo_095.people u WHERE u.id = p.id;

-- Rows added since, in the old words.
UPDATE public.team_members SET position = CASE position WHEN 'lead' THEN 'team_leader' ELSE 'collaborator' END
 WHERE position IN ('lead', 'member');
UPDATE public.people SET role_type = 'admin' WHERE role_type = 'super_admin';

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM undo_095.defs WHERE kind = 'constraint' LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.on_table, r.name, r.def);
  END LOOP;
  FOR r IN SELECT * FROM undo_095.defs WHERE kind = 'default' LOOP
    EXECUTE format('ALTER TABLE public.team_members ALTER COLUMN position SET DEFAULT %s', r.def);
  END LOOP;
  FOR r IN SELECT * FROM undo_095.defs WHERE kind = 'function' LOOP
    EXECUTE r.def;
  END LOOP;
END $$;

COMMIT;
