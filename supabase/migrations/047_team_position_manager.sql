-- 047_team_position_manager.sql
-- Add 'manager' to the team_members.position vocabulary (alongside founder,
-- team_leader, collaborator). A Manager sits below Founder and above Team
-- Leader in a team's hierarchy.

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_position_chk;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_position_chk CHECK (position IN ('founder', 'manager', 'team_leader', 'collaborator'));
