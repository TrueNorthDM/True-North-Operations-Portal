-- 055_snapshot_and_targets_not_public.sql
--
-- Two words were missing, and they were the difference between "everyone signed
-- in" and "the entire internet".
--
-- Every read policy in this schema is written `FOR SELECT TO authenticated
-- USING (true)`. These two were written `FOR SELECT USING (true)`. In Postgres,
-- a policy with no TO clause applies to PUBLIC, and PUBLIC includes the `anon`
-- role, the one behind the key that ships inside the JavaScript bundle.
--
-- Verified before writing this, unauthenticated, with that public key:
--
--   monday_snapshot     14.7 MB for board 462251934 alone: 950 items with their
--                       names, groups, states, every column value, the people
--                       assigned to them by name, and the board activity log.
--                       Same again for 6691665827.
--   publishing_targets  every board's weekly target per language.
--
-- The code half landed first, and had to: /api/snapshot and /api/targets both
-- read with the anon key, so locking the tables without changing them would
-- have taken the dashboards down. They now read with service_role, which
-- bypasses RLS, which is why this migration is safe to apply.
--
-- Not fixed here because it is not a policy problem: /api/snapshot took board
-- ids straight from the request body and live-fetched anything missing with the
-- portal's own Monday token, so a signed-in person could read any board in the
-- account. That is now an allowlist against lib/boards/config.ts.

DROP POLICY IF EXISTS monday_snapshot_read ON monday_snapshot;
CREATE POLICY monday_snapshot_read ON monday_snapshot FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS publishing_targets_read ON publishing_targets;
CREATE POLICY publishing_targets_read ON publishing_targets FOR SELECT TO authenticated
  USING (true);

-- Verify afterwards with the public anon key. Both must come back []:
--   curl "$URL/rest/v1/monday_snapshot?select=board_id" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   curl "$URL/rest/v1/publishing_targets?select=board_id" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
