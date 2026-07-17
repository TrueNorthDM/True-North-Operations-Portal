-- 035_person_role_type.sql
--
-- Directory "contact type" — classifies each person as user / admin /
-- admin_assistant / team_leader. Everyone defaults to 'user'; the exceptions
-- below are set by name. (This is a directory label, separate from the RBAC
-- `grants` roles that control project access.)

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS role_type text NOT NULL DEFAULT 'user'
  CHECK (role_type IN ('user', 'admin', 'admin_assistant', 'team_leader'));

UPDATE people SET role_type = 'admin'
  WHERE full_name IN ('Arnaldo Oliveira', 'David Sharpe');

UPDATE people SET role_type = 'admin_assistant'
  WHERE full_name IN ('Tina Gennette', 'Jônatas Oliveira');

UPDATE people SET role_type = 'team_leader'
  WHERE full_name IN ('Amy Prindle', 'Clarisse Nixon', 'Jeannette Owens',
                      'Kathleen Aguilar', 'Stephanie Aguirre', 'Joy Deche', 'Wendy Cacka');

COMMIT;
