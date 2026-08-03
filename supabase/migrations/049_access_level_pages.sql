-- 049_access_level_pages.sql
--
-- Per-level page/capability permissions: which surfaces each access level
-- (people.role_type) may reach. Turns the Access levels matrix from a written
-- description into configuration the app actually enforces.
--
-- 'admin' is deliberately NOT stored: a real admin always has everything, so
-- the portal can never be configured into a state with no way back. Rows only
-- ever exist for admin_assistant, team_leader and user.
--
-- surface_key is an app-level catalogue key (see src/lib/access/surfaces.ts),
-- NOT a foreign key, surfaces are code-defined routes, not DB rows. The valid
-- set is enforced in the server action.
--
-- Read is open to any signed-in user on purpose: the resolver runs under the
-- caller's own session to decide what to render, and "which menu items exist"
-- is UI chrome, not secret data. Writes stay admin-only.
--
-- Absent row = fall back to the code default for that surface + level
-- (src/lib/access/surfaces.ts), so a brand-new surface behaves sensibly before
-- anyone configures it.
--
-- Depends on 001 (update_updated_at), 007 (is_admin), 035 (people.role_type).

BEGIN;

CREATE TABLE IF NOT EXISTS access_level_pages (
  role_type   TEXT NOT NULL CHECK (role_type IN ('admin_assistant', 'team_leader', 'user')),
  surface_key TEXT NOT NULL,
  allowed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_type, surface_key)
);

DROP TRIGGER IF EXISTS access_level_pages_updated_at ON access_level_pages;
CREATE TRIGGER access_level_pages_updated_at BEFORE UPDATE ON access_level_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE access_level_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_level_pages_read ON access_level_pages;
CREATE POLICY access_level_pages_read ON access_level_pages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS access_level_pages_admin_write ON access_level_pages;
CREATE POLICY access_level_pages_admin_write ON access_level_pages FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

COMMIT;
