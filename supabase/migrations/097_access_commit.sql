-- 097_access_commit.sql
--
-- Every change to the access model, applied all or nothing (audit, 8 October
-- 2026, findings M3, M4 and M5 of the access module).
--
-- Before this, Admin > Access levels wrote a change in several steps (ticks,
-- then each tool's team list deleted and inserted again, then the log row),
-- each on its own. A failure half way left a tool with no team and no log
-- entry; a failed log left a change nobody could see; and two Super Admins
-- saving at once silently overwrote each other.
--
-- access_commit() does the whole change in one transaction:
--   1. waits for any other access change to finish (one at a time);
--   2. checks that what the change was based on is still what is stored
--      ("expected"), and refuses otherwise, so a stale page or a stale undo
--      cannot overwrite a newer change;
--   3. applies every operation;
--   4. writes the log row, and marks the undone change, in the same breath.
-- It returns the log row's id.
--
-- And a trigger keeps at least two active Super Admins, in the database
-- itself, so two demotions at the same moment cannot leave one.
--
-- Reversible: DROP FUNCTION access_commit(jsonb, jsonb, jsonb);
--             DROP TRIGGER people_keep_two_super_admins ON people;
--             DROP FUNCTION people_keep_two_super_admins();

BEGIN;

CREATE OR REPLACE FUNCTION access_commit(p_ops JSONB, p_expected JSONB, p_log JSONB)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e JSONB;
  op JSONB;
  cur BOOLEAN;
  cur_scope JSONB;
  cur_level TEXT;
  cur_ended BOOLEAN;
  n INT;
  v_id BIGINT;
BEGIN
  -- 1. One access change at a time, across every Super Admin.
  PERFORM pg_advisory_xact_lock(hashtext('access_model'));

  -- 2. What the change was based on must still be what is stored.
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_expected->'rules', '[]'::jsonb)) LOOP
    SELECT r.allowed INTO cur FROM access_rules r WHERE r.level = e->>'level' AND r.item_key = e->>'key';
    IF NOT FOUND THEN cur := NULL; END IF;
    IF cur IS DISTINCT FROM (e->>'allowed')::BOOLEAN THEN
      RAISE EXCEPTION 'access_changed_since' USING DETAIL = 'rule ' || (e->>'level') || ' ' || (e->>'key');
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_expected->'tools', '[]'::jsonb)) LOOP
    -- The same shape the portal reads (lib/access/store.ts loadRules): null
    -- when the tool has neither a scope row nor a team, else every + teams.
    SELECT CASE
             WHEN NOT EXISTS (SELECT 1 FROM access_tool_scope s WHERE s.item_key = e->>'key')
              AND NOT EXISTS (SELECT 1 FROM access_tool_teams t WHERE t.item_key = e->>'key') THEN NULL
             ELSE jsonb_build_object(
               'every', COALESCE((SELECT s.every_team FROM access_tool_scope s WHERE s.item_key = e->>'key'), false),
               'teams', COALESCE((SELECT jsonb_object_agg(t.team_id::TEXT, t.audience) FROM access_tool_teams t WHERE t.item_key = e->>'key'), '{}'::jsonb))
           END INTO cur_scope;
    IF cur_scope IS DISTINCT FROM NULLIF(e->'scope', 'null'::jsonb) THEN
      RAISE EXCEPTION 'access_changed_since' USING DETAIL = 'tool ' || (e->>'key');
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_expected->'levels', '[]'::jsonb)) LOOP
    SELECT p.access_level INTO cur_level FROM people p WHERE p.id = (e->>'person_id')::UUID;
    IF cur_level IS DISTINCT FROM (e->>'level') THEN
      RAISE EXCEPTION 'access_changed_since' USING DETAIL = 'level ' || (e->>'person_id');
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_expected->'exceptions', '[]'::jsonb)) LOOP
    SELECT x.ended_at IS NOT NULL INTO cur_ended FROM access_exceptions x WHERE x.id = (e->>'id')::UUID;
    IF NOT FOUND OR cur_ended IS DISTINCT FROM (e->>'ended')::BOOLEAN THEN
      RAISE EXCEPTION 'access_changed_since' USING DETAIL = 'exception ' || (e->>'id');
    END IF;
  END LOOP;

  -- 3. Apply.
  FOR op IN SELECT * FROM jsonb_array_elements(COALESCE(p_ops, '[]'::jsonb)) LOOP
    CASE op->>'op'
      WHEN 'rule_set' THEN
        INSERT INTO access_rules (level, item_key, allowed, updated_at)
        VALUES (op->>'level', op->>'key', (op->>'allowed')::BOOLEAN, now())
        ON CONFLICT (level, item_key) DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = now();
      WHEN 'rule_clear' THEN
        DELETE FROM access_rules WHERE level = op->>'level' AND item_key = op->>'key';
      WHEN 'tool_set' THEN
        INSERT INTO access_tool_scope (item_key, every_team, updated_at)
        VALUES (op->>'key', (op->>'every')::BOOLEAN, now())
        ON CONFLICT (item_key) DO UPDATE SET every_team = EXCLUDED.every_team, updated_at = now();
        DELETE FROM access_tool_teams WHERE item_key = op->>'key';
        IF NOT (op->>'every')::BOOLEAN THEN
          INSERT INTO access_tool_teams (item_key, team_id, audience)
          SELECT op->>'key', k::UUID, v
            FROM jsonb_each_text(COALESCE(op->'teams', '{}'::jsonb)) AS j(k, v);
        END IF;
      WHEN 'exception_add' THEN
        INSERT INTO access_exceptions (id, person_id, item_key, effect, until, reason, created_by)
        VALUES ((op->>'id')::UUID, (op->>'person_id')::UUID, op->>'key', op->>'effect',
                NULLIF(op->>'until', '')::DATE, op->>'reason', NULLIF(op->>'by', '')::UUID);
      WHEN 'exception_end' THEN
        UPDATE access_exceptions SET ended_at = now(), ended_by = NULLIF(op->>'by', '')::UUID
         WHERE id = (op->>'id')::UUID AND ended_at IS NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n <> 1 THEN RAISE EXCEPTION 'access_changed_since' USING DETAIL = 'exception ' || (op->>'id'); END IF;
      WHEN 'exception_reopen' THEN
        UPDATE access_exceptions SET ended_at = NULL, ended_by = NULL
         WHERE id = (op->>'id')::UUID AND ended_at IS NOT NULL;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n <> 1 THEN RAISE EXCEPTION 'access_changed_since' USING DETAIL = 'exception ' || (op->>'id'); END IF;
      WHEN 'person_level' THEN
        UPDATE people SET access_level = NULLIF(op->>'level', '') WHERE id = (op->>'person_id')::UUID;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n <> 1 THEN RAISE EXCEPTION 'access_unknown_person'; END IF;
        -- The database's own role (is_admin) follows the level (migration 095).
        IF NULLIF(op->>'profile_id', '') IS NOT NULL THEN
          UPDATE profiles SET role = CASE WHEN NULLIF(op->>'level', '') IS NULL THEN 'viewer' ELSE 'admin' END
           WHERE id = (op->>'profile_id')::UUID;
        END IF;
      ELSE
        RAISE EXCEPTION 'access_unknown_op' USING DETAIL = COALESCE(op->>'op', 'null');
    END CASE;
  END LOOP;

  -- 4. The log row, in the same transaction as what it records.
  INSERT INTO access_changes (actor_id, kind, summary, reason, changes, impact, undoes)
  VALUES (NULLIF(p_log->>'actor_id', '')::UUID, p_log->>'kind', p_log->>'summary', p_log->>'reason',
          COALESCE(p_log->'changes', '[]'::jsonb), NULLIF(p_log->'impact', 'null'::jsonb),
          NULLIF(p_log->>'undoes', '')::BIGINT)
  RETURNING id INTO v_id;

  IF NULLIF(p_log->>'undoes', '') IS NOT NULL THEN
    UPDATE access_changes SET undone_by = v_id
     WHERE id = (p_log->>'undoes')::BIGINT AND undone_by IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'access_already_undone'; END IF;
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION access_commit(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

-- At least two active Super Admins, always.
CREATE OR REPLACE FUNCTION people_keep_two_super_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE remaining INT;
BEGIN
  IF OLD.access_level = 'super_admin' AND COALESCE(OLD.status, 'active') <> 'inactive'
     AND (TG_OP = 'DELETE'
          OR NEW.access_level IS DISTINCT FROM 'super_admin'
          OR COALESCE(NEW.status, 'active') = 'inactive') THEN
    -- Serialised with access_commit, so two demotions cannot both pass.
    PERFORM pg_advisory_xact_lock(hashtext('access_model'));
    SELECT count(*) INTO remaining FROM people
     WHERE access_level = 'super_admin' AND COALESCE(status, 'active') <> 'inactive' AND id <> OLD.id;
    IF remaining < 2 THEN
      RAISE EXCEPTION 'at_least_two_super_admins';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS people_keep_two_super_admins ON people;
CREATE TRIGGER people_keep_two_super_admins
  BEFORE UPDATE OF access_level, status OR DELETE ON people
  FOR EACH ROW EXECUTE FUNCTION people_keep_two_super_admins();

COMMIT;
