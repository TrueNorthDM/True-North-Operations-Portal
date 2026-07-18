-- 037_team_tool_grants.sql
--
-- Team → tool/dashboard access. Part 3 of "People, Teams and Permissions":
-- records which app tools each team can reach, and for whom — the team lead
-- only ('lead') or every member ('all'). This is the DATA + admin-UI layer;
-- actual nav gating by role_type is Part 4. Until then, absence of a row means
-- "unrestricted" (everyone sees it), matching the rollout rule "for now every
-- team has access to everything".
--
-- tool_key is an app-level catalogue key (see src/lib/access/tools.ts), NOT a
-- foreign key — tools are code-defined surfaces (routes), not DB rows. The set
-- of valid keys is enforced in the server action, not by the DB.
--
-- Read is open to any signed-in user on purpose: which menu items a team sees
-- is UI chrome, not secret data, and Part 4's nav gating reads this under the
-- signed-in user's own session. Writes stay admin-only (mirrors `grants`).
--
-- Depends on 001 (update_updated_at), 007 (is_admin), 014 (teams).

BEGIN;

CREATE TABLE IF NOT EXISTS team_tool_grants (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tool_key   TEXT NOT NULL,                                       -- catalogue key (src/lib/access/tools.ts)
  audience   TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('lead','all')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, tool_key)                                 -- one setting per team per tool
);
CREATE INDEX IF NOT EXISTS team_tool_grants_team_idx ON team_tool_grants(team_id);

DROP TRIGGER IF EXISTS team_tool_grants_updated_at ON team_tool_grants;
CREATE TRIGGER team_tool_grants_updated_at BEFORE UPDATE ON team_tool_grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_tool_grants ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in user (nav visibility isn't secret). Write: admins only.
DROP POLICY IF EXISTS team_tool_grants_read ON team_tool_grants;
CREATE POLICY team_tool_grants_read ON team_tool_grants FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS team_tool_grants_admin_write ON team_tool_grants;
CREATE POLICY team_tool_grants_admin_write ON team_tool_grants FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

COMMIT;
