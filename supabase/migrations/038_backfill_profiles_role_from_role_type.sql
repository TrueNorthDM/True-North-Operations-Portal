-- 038_backfill_profiles_role_from_role_type.sql
--
-- Part 4 of "People, Teams and Permissions": a ONE-TIME alignment of the hard
-- auth gate (profiles.role) to the directory tier (people.role_type), so
-- role_type becomes the effective source of truth. Privileged tiers (admin,
-- admin_assistant) → 'admin'; restricted tiers (team_leader, user) → 'viewer'.
--
-- Only accounts LINKED to a directory person (people.profile_id) are touched —
-- unlinked service/admin accounts keep whatever role they have. This is a
-- manual, reviewable backfill (NOT a login-time sync), and it can DEMOTE a
-- current admin whose linked person is typed team_leader/user, so run the
-- preview below FIRST and confirm the changes are what you expect.
--
-- Preview (run before applying):
--   SELECT p.id, p.email, p.role AS current_role, pe.full_name, pe.role_type,
--          CASE WHEN pe.role_type IN ('admin','admin_assistant') THEN 'admin' ELSE 'viewer' END AS new_role
--   FROM profiles p
--   JOIN people pe ON pe.profile_id = p.id
--   WHERE p.role IS DISTINCT FROM
--         (CASE WHEN pe.role_type IN ('admin','admin_assistant') THEN 'admin' ELSE 'viewer' END);
--
-- Depends on 007 (profiles.role), 035 (people.role_type).

BEGIN;

UPDATE profiles p
   SET role = 'admin'
  FROM people pe
 WHERE pe.profile_id = p.id
   AND pe.role_type IN ('admin', 'admin_assistant')
   AND p.role IS DISTINCT FROM 'admin';

UPDATE profiles p
   SET role = 'viewer'
  FROM people pe
 WHERE pe.profile_id = p.id
   AND pe.role_type IN ('team_leader', 'user')
   AND p.role IS DISTINCT FROM 'viewer';

COMMIT;
