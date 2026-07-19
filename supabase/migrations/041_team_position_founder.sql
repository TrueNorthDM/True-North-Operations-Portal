-- 041_team_position_founder.sql
-- Add 'founder' to the team_members.position vocabulary (alongside team_leader
-- and collaborator). A Founder sits above Team Leader in a team's hierarchy.

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_position_chk;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_position_chk CHECK (position IN ('founder', 'team_leader', 'collaborator'));
