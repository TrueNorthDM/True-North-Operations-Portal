-- Run on production right BEFORE migration 095 (deploy/access/README.md).
-- Keeps what 095 rewrites in place (team positions, profiles.role,
-- people.role_type, two constraints, the position default and the sign-up
-- trigger's function), so 095-restore.sql can put them back if the new code
-- has to be rolled back after 095. In its own schema, which the database API
-- does not serve. Safe to run twice: a second run keeps the first snapshot.

CREATE SCHEMA IF NOT EXISTS undo_095;
REVOKE ALL ON SCHEMA undo_095 FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS undo_095.members AS SELECT team_id, person_id, position FROM public.team_members;
CREATE TABLE IF NOT EXISTS undo_095.profiles AS SELECT id, role FROM public.profiles;
CREATE TABLE IF NOT EXISTS undo_095.people AS SELECT id, role_type FROM public.people;
CREATE TABLE IF NOT EXISTS undo_095.defs AS
  SELECT 'constraint'::text AS kind, conrelid::regclass::text AS on_table, conname::text AS name, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
   WHERE conrelid IN ('public.team_members'::regclass, 'public.people'::regclass)
     AND conname IN ('team_members_position_chk', 'people_role_type_check', 'people_role_type_chk')
  UNION ALL
  SELECT 'default', 'public.team_members', 'position', pg_get_expr(d.adbin, d.adrelid)
    FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
   WHERE d.adrelid = 'public.team_members'::regclass AND a.attname = 'position'
  UNION ALL
  SELECT 'function', NULL, 'handle_new_user', pg_get_functiondef('public.handle_new_user()'::regprocedure);

SELECT (SELECT count(*) FROM undo_095.members) AS members, (SELECT count(*) FROM undo_095.profiles) AS profiles,
       (SELECT count(*) FROM undo_095.people) AS people, (SELECT count(*) FROM undo_095.defs) AS defs;
