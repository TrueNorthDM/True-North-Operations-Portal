-- 048_team_member_primary.sql
-- Explicit PRIMARY department per person. A person can be on several teams, but
-- exactly one membership is their main department, which drives the org chart
-- card color and the "Team" shown in the People tab. Secondary teams still show
-- as chips.

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- At most one primary team per person (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_primary_idx
  ON team_members (person_id) WHERE is_primary;

-- Backfill: each person's primary = their highest-ranked position
-- (founder > manager > team_leader > collaborator), tie-broken by team name.
WITH ranked AS (
  SELECT tm.person_id, tm.team_id,
         row_number() OVER (
           PARTITION BY tm.person_id
           ORDER BY CASE tm.position
                      WHEN 'founder' THEN 0
                      WHEN 'manager' THEN 1
                      WHEN 'team_leader' THEN 2
                      ELSE 3 END,
                    te.name
         ) AS rn
  FROM team_members tm
  JOIN teams te ON te.id = tm.team_id
)
UPDATE team_members tm
SET is_primary = true
FROM ranked r
WHERE r.person_id = tm.person_id AND r.team_id = tm.team_id AND r.rn = 1;
