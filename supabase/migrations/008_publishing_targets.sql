-- Publishing targets: per board × language weekly target.
--
-- Brought in from the COE Dashboard. Read by GET /api/targets (for display) and
-- edited by admins in the Boards Review targets editor. Until this table exists,
-- /api/targets returns 502 and the dashboard uses its hardcoded fallback — so
-- wiring the route ahead of this migration was safe.
--
-- Depends on 007 (is_admin) for the write policy.

BEGIN;

CREATE TABLE IF NOT EXISTS publishing_targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id     TEXT NOT NULL,
  board_short  TEXT,
  language     TEXT NOT NULL,
  target_value INTEGER NOT NULL DEFAULT 0,
  period_type  TEXT NOT NULL DEFAULT 'weekly',
  updated_by   TEXT,                         -- email of the admin who last wrote
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (board_id, language, period_type)
);

DROP TRIGGER IF EXISTS publishing_targets_updated_at ON publishing_targets;
CREATE TRIGGER publishing_targets_updated_at
  BEFORE UPDATE ON publishing_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS.
--   read:  public. The targets aren't sensitive, and GET /api/targets queries
--          with the anon key server-side (the endpoint itself is still behind
--          the portal auth gate). This mirrors the COE "read public" posture.
--   write: admins only (the targets editor).
ALTER TABLE publishing_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publishing_targets_read ON publishing_targets;
CREATE POLICY publishing_targets_read
  ON publishing_targets FOR SELECT
  USING (true);

DROP POLICY IF EXISTS publishing_targets_admin_write ON publishing_targets;
CREATE POLICY publishing_targets_admin_write
  ON publishing_targets FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Seed the known weekly targets (from the COE PUBLISHING_TARGETS_FALLBACK).
-- These inserts run before the audit trigger exists (009), so they don't
-- generate audit rows — which is correct, they're bootstrap data, not edits.
INSERT INTO publishing_targets (board_id, board_short, language, target_value, period_type) VALUES
  ('6691665827', 'HFA-P',  'English',    5, 'weekly'),
  ('6691665827', 'HFA-P',  'Swahili',    5, 'weekly'),
  ('462251934',  'AAAF-P', 'English',    2, 'weekly'),
  ('462251934',  'AAAF-P', 'Swahili',    3, 'weekly'),
  ('462251934',  'AAAF-P', 'Portuguese', 3, 'weekly'),
  ('462251934',  'AAAF-P', 'Spanish',    3, 'weekly')
ON CONFLICT (board_id, language, period_type) DO NOTHING;

COMMIT;
