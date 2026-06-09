-- 014_directory_and_access.sql
--
-- F1 of the portal RBAC + org chart work. Creates ONE People & Teams directory
-- that powers BOTH the company org chart and access control — so "who's on a
-- team" has a single source of truth (no drift between the org chart and who
-- can actually reach a project).
--
-- Model notes (from the current org chart):
--   - A person may have NO portal login (writers, translators, …). profile_id
--     links to an account only when they have one.
--   - Reporting line (manager_id) is SEPARATE from team membership.
--   - People belong to MANY teams (Kathleen is a team leader AND an SEO
--     strategist), so membership is many-to-many.
--   - Access is granted per PROJECT (= a site, AAAF/HFA for now), to a TEAM
--     (usual) or a single PERSON (exception), with a role.
--
-- Depends on 001 (update_updated_at), 007 (is_admin, profiles).

BEGIN;

-- ── People — the org directory (broader than portal users) ──────────────────
CREATE TABLE IF NOT EXISTS people (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL,
  title       TEXT,                                              -- role/function, e.g. "VPO", "SEO Team Leader"
  manager_id  UUID REFERENCES people(id)   ON DELETE SET NULL,   -- reporting line (org chart hierarchy)
  profile_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,   -- portal account, if any (NULL = no login)
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order  INT  NOT NULL DEFAULT 0,                           -- order among siblings in the chart
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS people_manager_idx ON people(manager_id);
CREATE INDEX IF NOT EXISTS people_profile_idx ON people(profile_id);

-- ── Teams — groupings (a person can be on several) ──────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  leader_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  color            TEXT,                                         -- optional chart accent (e.g. "#F4C24A")
  sort_order       INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Team membership — many-to-many ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  team_id    UUID NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, person_id)
);
CREATE INDEX IF NOT EXISTS team_members_person_idx ON team_members(person_id);

-- ── Access grants — RBAC. project = a site (AAAF/HFA) for now ────────────────
CREATE TABLE IF NOT EXISTS grants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('team','person')),
  subject_id   UUID NOT NULL,                                    -- teams.id or people.id (per subject_type)
  project_id   UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('admin','member','viewer')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_type, subject_id, project_id)                  -- one role per subject per project
);
CREATE INDEX IF NOT EXISTS grants_project_idx ON grants(project_id);
CREATE INDEX IF NOT EXISTS grants_subject_idx ON grants(subject_type, subject_id);

-- ── updated_at triggers (reuse update_updated_at from 001) ──────────────────
DROP TRIGGER IF EXISTS people_updated_at ON people;
CREATE TRIGGER people_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS grants_updated_at ON grants;
CREATE TRIGGER grants_updated_at BEFORE UPDATE ON grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE people       ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants       ENABLE ROW LEVEL SECURITY;

-- Directory: any signed-in user can READ (the org chart shows for everyone);
-- only admins can WRITE. Mirrors the publishing_targets read/admin_write split.
DROP POLICY IF EXISTS people_read ON people;
CREATE POLICY people_read ON people FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS people_admin_write ON people;
CREATE POLICY people_admin_write ON people FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS teams_read ON teams;
CREATE POLICY teams_read ON teams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS teams_admin_write ON teams;
CREATE POLICY teams_admin_write ON teams FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS team_members_read ON team_members;
CREATE POLICY team_members_read ON team_members FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS team_members_admin_write ON team_members;
CREATE POLICY team_members_admin_write ON team_members FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Grants are access configuration → admin-only for both read and write.
DROP POLICY IF EXISTS grants_admin ON grants;
CREATE POLICY grants_admin ON grants FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

COMMIT;
