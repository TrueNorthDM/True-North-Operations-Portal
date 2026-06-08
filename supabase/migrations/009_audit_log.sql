-- Audit log of publishing-target changes.
--
-- Brought in from the COE Dashboard. Immutable by design: rows are written only
-- by a SECURITY DEFINER trigger on publishing_targets, are readable by admins,
-- and have no UPDATE/DELETE policies — so the history can't be tampered with
-- from the client.
--
-- Depends on 007 (is_admin) and 008 (publishing_targets).

BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,
  action     TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  entity_id  UUID,                          -- the publishing_targets row id
  before     JSONB,
  after      JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- Records every change to publishing_targets with a before/after snapshot.
-- The actor email comes from the row's updated_by (the editor stamps it on
-- insert/update; for deletes we read the last-known updated_by).
CREATE OR REPLACE FUNCTION log_target_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (user_email, action, entity_id, before, after)
      VALUES (OLD.updated_by, 'delete', OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (user_email, action, entity_id, before, after)
      VALUES (NEW.updated_by, 'update', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE  -- INSERT
    INSERT INTO audit_log (user_email, action, entity_id, before, after)
      VALUES (NEW.updated_by, 'insert', NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS publishing_targets_audit ON publishing_targets;
CREATE TRIGGER publishing_targets_audit
  AFTER INSERT OR UPDATE OR DELETE ON publishing_targets
  FOR EACH ROW EXECUTE FUNCTION log_target_change();

-- RLS: admins read; the SECURITY DEFINER trigger inserts (bypassing RLS).
-- No INSERT/UPDATE/DELETE policies → immutable from any client.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_read ON audit_log;
CREATE POLICY audit_log_admin_read
  ON audit_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

COMMIT;
