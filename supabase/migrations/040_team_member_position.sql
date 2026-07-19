-- 040_team_member_position.sql
-- Per-team POSITION on membership: a person can be the Team Leader of one team
-- and a Collaborator in another. This replaces the single teams.leader_person_id
-- "lead" (the app stops using that column; it is left in place, unused).

-- 1) Add the column (default = collaborator) + a value check.
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT 'collaborator';

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_position_chk;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_position_chk CHECK (position IN ('team_leader', 'collaborator'));

-- 2) Backfill: today's team lead (teams.leader_person_id) becomes the team_leader
--    position on that membership — inserting the membership row if the lead was
--    not already listed as a member of the team.
INSERT INTO team_members (team_id, person_id, position)
SELECT t.id, t.leader_person_id, 'team_leader'
FROM teams t
WHERE t.leader_person_id IS NOT NULL
ON CONFLICT (team_id, person_id) DO UPDATE SET position = 'team_leader';

-- Preview (optional — run on its own to eyeball the result):
-- SELECT tm.team_id, te.name AS team, p.full_name, tm.position
-- FROM team_members tm
-- JOIN teams te ON te.id = tm.team_id
-- JOIN people p ON p.id = tm.person_id
-- ORDER BY te.name, (tm.position <> 'team_leader'), p.full_name;
