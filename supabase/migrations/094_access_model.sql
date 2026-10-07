-- 094_access_model.sql
--
-- The access model decided on 7 October 2026 (docs/access/01-design.md).
--
-- Four levels: Super Admin and Admin are given (people.access_level); Team
-- Leader and User follow team positions (Lead of any team, or not). What each
-- level opens is one tick per catalogue item (src/lib/access/catalogue.ts);
-- tools also need one of the person's teams on their team list. Exceptions
-- open or close one item for one person until a date. Every change is logged
-- with its reason.
--
-- Additive: the old tables (access_level_pages, team_tool_grants) stay until
-- the release after, and nothing here changes what the code running now
-- reads. Team positions are converted by 095, after the new code is live.
--
-- All five tables are read and written by the server with the service role,
-- for a person it has already identified and checked. The signed-in role
-- reads none of them (the log names people and their reasons).

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS access_level TEXT
  CHECK (access_level IN ('super_admin', 'admin'));

UPDATE people SET access_level = 'super_admin'
 WHERE status = 'active' AND full_name IN ('Arnaldo Oliveira', 'David Sharpe');
UPDATE people SET access_level = 'admin'
 WHERE status = 'active' AND full_name IN ('Tina Gennette', 'Jônatas Queiroz', 'Wendy Cacka', 'Jeannette Owens');

-- What each level opens. No row: the catalogue's starting answer.
CREATE TABLE IF NOT EXISTS access_rules (
  level      TEXT NOT NULL CHECK (level IN ('admin', 'team_leader', 'user')),
  item_key   TEXT NOT NULL,
  allowed    BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (level, item_key)
);

-- Which teams may use a tool: every team, or only those listed.
CREATE TABLE IF NOT EXISTS access_tool_scope (
  item_key   TEXT PRIMARY KEY,
  every_team BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_tool_teams (
  item_key TEXT NOT NULL,
  team_id  UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('team', 'lead')),
  PRIMARY KEY (item_key, team_id)
);

-- One person, one item, until a date (null: until removed).
CREATE TABLE IF NOT EXISTS access_exceptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,
  effect     TEXT NOT NULL CHECK (effect IN ('grant', 'deny')),
  until      DATE,
  reason     TEXT NOT NULL,
  created_by UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at   TIMESTAMPTZ,
  ended_by   UUID REFERENCES people(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS access_exceptions_person_idx ON access_exceptions (person_id) WHERE ended_at IS NULL;

-- The change log. `changes` is what was done (before and after, per item);
-- `impact` is who gained and lost, as computed at the moment of saving.
CREATE TABLE IF NOT EXISTS access_changes (
  id        BIGSERIAL PRIMARY KEY,
  at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id  UUID REFERENCES people(id) ON DELETE SET NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('rules', 'tool-teams', 'level', 'exception', 'position', 'undo')),
  summary   TEXT NOT NULL,
  reason    TEXT NOT NULL,
  changes   JSONB NOT NULL,
  impact    JSONB,
  undoes    BIGINT REFERENCES access_changes(id),
  undone_by BIGINT REFERENCES access_changes(id)
);
CREATE INDEX IF NOT EXISTS access_changes_at_idx ON access_changes (at DESC);

-- Tool team lists, from the team grants of the Directory's Teams tab.
INSERT INTO access_tool_teams (item_key, team_id, audience)
SELECT g.tool_key, g.team_id, CASE g.audience WHEN 'lead' THEN 'lead' ELSE 'team' END
  FROM team_tool_grants g
 WHERE g.tool_key IN ('schema-app', 'schema-scraper', 'knowledge-graph', 'page-auditor', 'image-optimization',
                      'analytics', 'impact-globe', 'href-links', 'publishing', 'i7-budget', 'grant-pass-report')
ON CONFLICT DO NOTHING;

-- Team positions: Lead and Member join the old words until 095 converts them.
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_position_chk;
ALTER TABLE team_members ADD CONSTRAINT team_members_position_chk
  CHECK (position IN ('lead', 'member', 'founder', 'manager', 'team_leader', 'collaborator'));

ALTER TABLE access_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tool_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tool_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_changes    ENABLE ROW LEVEL SECURITY;

-- The first entry of the log: the move itself.
INSERT INTO access_changes (kind, summary, reason, changes)
VALUES ('level', 'The new access model',
        'Owner''s decision of 7 October 2026: four levels (Super Admin, Admin, Team Leader automatic from team Lead, User), one list of every page, tab and action, and team lists per tool.',
        jsonb_build_object('super_admin', jsonb_build_array('Arnaldo Oliveira', 'David Sharpe'),
                           'admin', jsonb_build_array('Tina Gennette', 'Jônatas Queiroz', 'Wendy Cacka', 'Jeannette Owens')));

COMMIT;
