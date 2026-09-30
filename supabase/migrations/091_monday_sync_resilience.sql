-- 091: the Monday sync (My Work) holds up when something goes wrong.
--
-- Phase 5 of the My Work plan (docs/my-work/00-briefing.md). Everything here is
-- new; nothing existing is changed or removed, and the code keeps its old
-- behaviour until this has run.
--
--   monday_sync_runs      one row per hop: what it read, what failed, how long.
--                         A board that fails is skipped for the rest of that run
--                         instead of stopping every board after it.
--   monday_sync_lock      one row: which run holds the sync. A second firing
--                         (the cron and a manual run, say) waits its turn instead
--                         of rewriting the same boards at the same time.
--   monday_boards.gone_at when discovery stopped seeing the board in Monday
--                         (archived or deleted). Gone boards are not read.
--   monday_assignments_staging + monday_swap_board_assignments(board, batch):
--                         a board's rows are written to staging, then swapped in
--                         in one transaction. A write that fails half way leaves
--                         the board as it was, instead of half empty.
--
-- Service role only: the sync writes with the admin client, and nothing here is
-- read by a signed-in person.

-- ── Runs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monday_sync_runs (
  id           BIGSERIAL PRIMARY KEY,
  since        TIMESTAMPTZ NOT NULL,          -- the firing this hop belongs to
  hop          INT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  boards_read  INT NOT NULL DEFAULT 0,
  items        INT NOT NULL DEFAULT 0,
  assignments  INT NOT NULL DEFAULT 0,
  remaining    INT,
  -- [{ "board": 123, "name": "...", "error": "..." }]
  failed       JSONB NOT NULL DEFAULT '[]'::jsonb,
  gone         INT NOT NULL DEFAULT 0,        -- boards discovery marked gone (hop 0)
  chained      TEXT,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS monday_sync_runs_since_idx ON monday_sync_runs (since);
ALTER TABLE monday_sync_runs ENABLE ROW LEVEL SECURITY;

-- ── Lock ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monday_sync_lock (
  id          INT PRIMARY KEY CHECK (id = 1),
  holder      TEXT,                            -- the "since" of the run holding it
  expires_at  TIMESTAMPTZ
);
INSERT INTO monday_sync_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE monday_sync_lock ENABLE ROW LEVEL SECURITY;

-- ── Boards gone from Monday ─────────────────────────────────────────────────
ALTER TABLE monday_boards ADD COLUMN IF NOT EXISTS gone_at TIMESTAMPTZ;

-- ── Writing a board in one step ─────────────────────────────────────────────
-- The same columns as monday_assignments (and any added to it later: the swap
-- copies only the columns both tables have), without its unique key, plus the
-- batch the rows belong to.
CREATE TABLE IF NOT EXISTS monday_assignments_staging
  (LIKE monday_assignments INCLUDING DEFAULTS);
ALTER TABLE monday_assignments_staging ADD COLUMN IF NOT EXISTS batch UUID NOT NULL;
CREATE INDEX IF NOT EXISTS monday_assignments_staging_batch_idx ON monday_assignments_staging (batch);
ALTER TABLE monday_assignments_staging ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION monday_swap_board_assignments(p_board BIGINT, p_batch UUID)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cols TEXT;
  n    INT;
BEGIN
  -- The columns both tables share, except the generated id.
  SELECT string_agg(quote_ident(a.column_name), ', ' ORDER BY a.ordinal_position)
    INTO cols
    FROM information_schema.columns a
    JOIN information_schema.columns s
      ON s.table_schema = 'public' AND s.table_name = 'monday_assignments_staging'
     AND s.column_name = a.column_name
   WHERE a.table_schema = 'public' AND a.table_name = 'monday_assignments'
     AND a.column_name <> 'id';

  DELETE FROM monday_assignments WHERE board_id = p_board;
  EXECUTE format(
    'INSERT INTO monday_assignments (%1$s) SELECT %1$s FROM monday_assignments_staging WHERE batch = $1 AND board_id = $2',
    cols) USING p_batch, p_board;
  GET DIAGNOSTICS n = ROW_COUNT;

  DELETE FROM monday_assignments_staging WHERE batch = p_batch;
  -- Batches a failed write left behind.
  DELETE FROM monday_assignments_staging WHERE synced_at < now() - interval '1 day';
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION monday_swap_board_assignments(BIGINT, UUID) FROM PUBLIC, anon, authenticated;
