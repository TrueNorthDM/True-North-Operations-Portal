-- 085_monday_priority_grants.sql
--
-- People given the right to set team priorities on My Work by name.
--
-- Decided on 16 September 2026. A team's priority order (084) can be set by:
--   - admins, every team, always;
--   - a level, through the two Team priority rows on Admin → Access levels
--     ("the teams they lead" and "every team"), stored in access_level_pages
--     like every other row there, so they need nothing new;
--   - the people listed in this table, whatever their level.
--
-- One row per person. scope 'member' is the teams they are on, in any position;
-- 'all' is every team. Taking the right away deletes the row.
--
-- Readable by anyone signed in: My Work asks, under the person's own session,
-- whether they may change their team's order. Written by admins only, through
-- the Access levels page and the admin's own session, the same way that page
-- writes the level matrix (049).
--
-- A person deleted, or merged away as a duplicate (063), loses their row with
-- them; the person kept is given it again by hand if they should have it.

BEGIN;

CREATE TABLE IF NOT EXISTS monday_priority_grants (
  person_id  UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL CHECK (scope IN ('member', 'all')),
  granted_by UUID REFERENCES people(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE monday_priority_grants IS
  'People who may set team priority orders on My Work regardless of their level. Edited on Admin → Access levels.';
COMMENT ON COLUMN monday_priority_grants.scope IS
  '''member'' = the teams they are on, in any position; ''all'' = every team.';

ALTER TABLE monday_priority_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monday_priority_grants_read ON monday_priority_grants;
CREATE POLICY monday_priority_grants_read ON monday_priority_grants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS monday_priority_grants_admin_write ON monday_priority_grants;
CREATE POLICY monday_priority_grants_admin_write ON monday_priority_grants
  FOR ALL TO authenticated
  USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())));

COMMIT;
