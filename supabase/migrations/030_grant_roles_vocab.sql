-- Directory Access tab: switch the team→project grant role vocabulary from the
-- generic admin/member/viewer to the product vocabulary shown in the design —
-- Manager / Publisher / Editor / Viewer.
--
-- The grant `role` is a LABEL only: capability gating in the app is done via
-- profiles.role = 'admin' (super-admin), not via this column. So remapping the
-- values is safe. Existing rows are migrated: admin→manager, member→editor,
-- viewer→viewer. Values are stored lower-case; the UI title-cases them.

BEGIN;

-- Drop the old CHECK so we can rewrite the values.
ALTER TABLE grants DROP CONSTRAINT IF EXISTS grants_role_check;

-- Remap existing grants to the new vocabulary.
UPDATE grants SET role = 'manager' WHERE role = 'admin';
UPDATE grants SET role = 'editor'  WHERE role = 'member';
-- 'viewer' stays 'viewer'.

-- New allowed set.
ALTER TABLE grants
  ADD CONSTRAINT grants_role_check CHECK (role IN ('manager', 'publisher', 'editor', 'viewer'));

COMMIT;
