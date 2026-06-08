-- Warm store for Monday board data.
--
-- Populated nightly by the ingestion cron (/api/cron/ingest) so the dashboards
-- read instantly from here instead of fetching live from Monday on every load.
-- One row per board, overwritten each run; `data` holds { items, groups,
-- activity } exactly as /api/snapshot used to return live.

BEGIN;

CREATE TABLE IF NOT EXISTS monday_snapshot (
  board_id    TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monday_snapshot ENABLE ROW LEVEL SECURITY;

-- Read: public. The data isn't sensitive (it's Monday board state) and the
-- dashboards are behind the portal auth gate anyway. Reading via the anon key
-- means /api/snapshot works locally without the service-role key, and there's
-- no per-load Monday fetch. Writes happen only via the service-role cron,
-- which bypasses RLS — so there's no write policy here.
DROP POLICY IF EXISTS monday_snapshot_read ON monday_snapshot;
CREATE POLICY monday_snapshot_read
  ON monday_snapshot FOR SELECT
  USING (true);

COMMIT;
