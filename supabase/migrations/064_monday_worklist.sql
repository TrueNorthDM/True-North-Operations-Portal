-- 064_monday_worklist.sql
--
-- The tables behind My Work: everything assigned to a person across the Monday
-- account, one row per step rather than one row per item.
--
-- WHY IT IS SHAPED THIS WAY, from surveying the account rather than guessing:
--
--   262 boards, 197 of them carry at least one people column, 25,042 items.
--   Worst case is one row per item per people column, so tens of thousands:
--   comfortable for Postgres, impossible to fetch live from Monday per page
--   load. Hence monday_assignments, filled by a slice-at-a-time ingest.
--
--   activity_logs accepts item_ids, so a single item's history comes back on
--   demand. NOTHING here stores history. That is a whole ingest that does not
--   need to exist.
--
--   93 of the boards are "Subitems of X" holding 4,638 items. A step usually
--   lives on the subitem while the thing a person recognises is the parent, so
--   an assignment carries both.

BEGIN;

-- ── Who, on the Monday side ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monday_users (
  id         BIGINT PRIMARY KEY,          -- Monday's own user id
  name       TEXT NOT NULL,
  email      TEXT,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  is_guest   BOOLEAN NOT NULL DEFAULT false,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which directory person a Monday account is.
--
-- No is_primary column here, unlike tc_user_links, and the difference is on
-- purpose: there a rate is keyed by the TSheets account, so the system has to
-- know which account speaks for the money. Nothing is keyed by a Monday
-- account. A primary flag would be a field nobody reads and somebody later
-- misreads.
CREATE TABLE IF NOT EXISTS monday_user_links (
  monday_user_id BIGINT PRIMARY KEY REFERENCES monday_users(id) ON DELETE CASCADE,
  person_id      UUID   NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  linked_by      TEXT   NOT NULL DEFAULT 'email' CHECK (linked_by IN ('email','name','manual')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monday_user_links_person_idx ON monday_user_links (person_id);

-- ── Where ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monday_boards (
  id               BIGINT PRIMARY KEY,
  name             TEXT NOT NULL,
  workspace_id     BIGINT,
  workspace_name   TEXT,
  kind             TEXT,
  -- "Subitems of X" is a board of its own in Monday's model, which is why the
  -- account reports 262 boards for far fewer things a person would name.
  is_subitem_board BOOLEAN NOT NULL DEFAULT false,
  items_count      INT,
  -- The workspace filter lives here rather than in the ingest, so leaving a
  -- board out is visible and reversible instead of being a rule in code.
  included         BOOLEAN NOT NULL DEFAULT true,
  synced_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS monday_boards_ws_idx ON monday_boards (workspace_id);

-- ── What counts as a step ───────────────────────────────────────────────────
--
-- One row per (board, people column). Seeded by the rule the survey scored:
-- a step's owner sits immediately to the LEFT of that step's status column, so
-- the status to look at is the one on the owner's RIGHT. Scored against the
-- four hand-mapped boards, right-hand matching got every column that was
-- comparable and found eight owners the hand-written config had never mapped
-- at all. Left-hand matching got none.
--
-- source says where the row came from, and is the whole point: a guess that
-- nobody can correct is worse than a blank form.
--   guess      the rule's default, in use until somebody looks
--   confirmed  a person checked it
--   off        this people column is not a step (Owner, Watcher, Requested by)
CREATE TABLE IF NOT EXISTS monday_board_steps (
  board_id     BIGINT NOT NULL REFERENCES monday_boards(id) ON DELETE CASCADE,
  people_col   TEXT   NOT NULL,
  people_title TEXT   NOT NULL,
  status_col   TEXT,
  step_name    TEXT   NOT NULL,
  position     INT    NOT NULL,
  source       TEXT   NOT NULL DEFAULT 'guess' CHECK (source IN ('guess','confirmed','off')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, people_col)
);

-- ── The work itself ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monday_assignments (
  id                BIGSERIAL PRIMARY KEY,
  board_id          BIGINT NOT NULL REFERENCES monday_boards(id) ON DELETE CASCADE,
  item_id           BIGINT NOT NULL,
  item_name         TEXT   NOT NULL,
  -- Set when the row came off a subitem: the step is on the subitem, but the
  -- thing a person recognises is the parent. Showing "Portuguese" as a task
  -- without saying which page it belongs to is not a task list.
  parent_item_id    BIGINT,
  parent_item_name  TEXT,
  group_title       TEXT,
  people_col        TEXT   NOT NULL,
  monday_user_id    BIGINT NOT NULL,
  -- Read from the column's value JSON, not from its text. The display name is
  -- what somebody typed; the id is who they are.
  status_col        TEXT,
  status_text       TEXT,
  status_index      INT,
  status_done       BOOLEAN,
  item_updated_at   TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, people_col, monday_user_id)
);
CREATE INDEX IF NOT EXISTS monday_assignments_user_idx  ON monday_assignments (monday_user_id);
CREATE INDEX IF NOT EXISTS monday_assignments_board_idx ON monday_assignments (board_id);
CREATE INDEX IF NOT EXISTS monday_assignments_open_idx  ON monday_assignments (monday_user_id)
  WHERE status_done IS NOT TRUE;

-- ── Reading rules ───────────────────────────────────────────────────────────
--
-- Readable by anyone signed in: this is who is doing what, which is the same
-- thing the boards dashboards already show. Written by admins and the ingest.

ALTER TABLE monday_users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_user_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_boards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_board_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE monday_assignments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['monday_users','monday_user_links','monday_boards','monday_board_steps','monday_assignments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_read ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_read ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_write ON %I', t, t);
    EXECUTE format($f$CREATE POLICY %I_admin_write ON %I FOR ALL TO authenticated
                      USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())))$f$, t, t);
  END LOOP;
END $$;

-- ── Merging people has to move these too ────────────────────────────────────
--
-- Migration 063 exists because things that point at a person get orphaned when
-- two records are joined. Adding a new one of those without teaching the merge
-- about it would rebuild the same bug a week later.

CREATE OR REPLACE FUNCTION merge_monday_links(winner UUID, loser UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  -- A Monday account already on the winner keeps its row; the loser's copy of
  -- that same account would violate the primary key, so it goes.
  DELETE FROM monday_user_links l
   WHERE l.person_id = loser
     AND EXISTS (SELECT 1 FROM monday_user_links w
                  WHERE w.person_id = winner AND w.monday_user_id = l.monday_user_id);
  UPDATE monday_user_links SET person_id = winner WHERE person_id = loser;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION merge_monday_links(UUID, UUID) FROM PUBLIC, anon;

COMMIT;
