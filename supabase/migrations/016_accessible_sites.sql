-- 016_accessible_sites.sql
--
-- F4 enforcement helper. Returns the set of project (site) ids a user can
-- reach. SECURITY DEFINER so it can read grants/team_members/people (which are
-- otherwise admin-only / RLS-restricted) on behalf of any signed-in user.
--
-- Safe-by-default rule ("unrestricted until first grant"):
--   - super-admins (is_admin) reach EVERY site;
--   - a site with NO grants at all is reachable by EVERYONE (nothing hidden
--     until you deliberately grant access to it);
--   - otherwise a user reaches a site only via a team grant (their team) or a
--     direct person grant.
--
-- Depends on 007 (is_admin) and 014 (people/teams/team_members/grants).

CREATE OR REPLACE FUNCTION accessible_site_ids(uid UUID)
RETURNS TABLE(site_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- admins: all sites
  SELECT id FROM sites WHERE is_admin(uid)
  UNION
  -- unrestricted sites (no grants at all)
  SELECT s.id FROM sites s
   WHERE NOT EXISTS (SELECT 1 FROM grants g WHERE g.project_id = s.id)
  UNION
  -- granted via the user's team membership
  SELECT g.project_id
    FROM grants g
    JOIN team_members tm ON g.subject_type = 'team' AND tm.team_id = g.subject_id
    JOIN people p ON p.id = tm.person_id AND p.profile_id = uid
  UNION
  -- granted directly to the user's person record
  SELECT g.project_id
    FROM grants g
    JOIN people p ON g.subject_type = 'person' AND p.id = g.subject_id AND p.profile_id = uid;
$$;

GRANT EXECUTE ON FUNCTION accessible_site_ids(UUID) TO authenticated;
