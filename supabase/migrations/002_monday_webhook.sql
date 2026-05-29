-- Monday webhook integration: schema additions.
--
-- Goals:
--   1. Store per-site Monday column IDs + language label mapping.
--      Each board has different column IDs and different ways of naming
--      languages ("English", "Swahili", ...). Putting it in a JSONB on
--      `sites` keeps the integration data-driven — change a column on
--      Monday's side, update the JSONB, no redeploy.
--
--   2. Store the HMAC signing secret Monday hands out when you register
--      the webhook. Used to verify each incoming payload is actually
--      from Monday, not an attacker spoofing our endpoint.
--
--   3. Remember which Monday item a saved URL came from. Each item is
--      "one page in one language" — when all languages are ready and the
--      system needs to flip every sibling item to "Apply Link", it needs
--      the item IDs of those siblings. Storing monday_item_id on
--      page_urls lets us list them with a single query.
--
--   4. Audit log of every webhook delivery. Without this, debugging
--      "why didn't X get processed?" turns into archaeology. With it,
--      we have a queryable trail of every event Monday sent us, what we
--      did, and what went wrong.

BEGIN;

-- 1. Per-site Monday column mapping
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS monday_column_ids JSONB;

-- Seed AAAF mapping (board 462251934)
UPDATE sites SET monday_column_ids = '{
  "hrefLinksStatus": "color_mm1z7ve4",
  "language":         "color_mkqr7s1t",
  "pageLink":         "text_mkp6jrqs",
  "languageMap": {
    "English":    "en",
    "Portuguese": "pt",
    "Spanish":    "es",
    "Swahili":    "sw",
    "French":     "fr"
  }
}'::jsonb
WHERE code = 'aaaf';

-- Seed HFA mapping (board 6691665827)
UPDATE sites SET monday_column_ids = '{
  "hrefLinksStatus": "color_mkr2bbjs",
  "language":         "status_Mjj4VcPh",
  "pageLink":         "link8",
  "languageMap": {
    "English": "en",
    "Swahili": "sw",
    "French":  "fr"
  }
}'::jsonb
WHERE code = 'hfa';

-- 2. HMAC signing secret (issued by Monday when registering the webhook)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS monday_signing_secret TEXT;

-- 3. monday_item_id on page_urls (one item per language)
ALTER TABLE page_urls
  ADD COLUMN IF NOT EXISTS monday_item_id TEXT;

-- 4. Audit log of every webhook delivery
CREATE TABLE IF NOT EXISTS monday_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type     TEXT NOT NULL,        -- e.g. 'change_column_value', 'create_pulse'
  board_id       TEXT,
  monday_item_id TEXT,
  column_id      TEXT,
  old_value      JSONB,
  new_value      JSONB,
  user_id        TEXT,                  -- Monday userId of the actor
  processed_at   TIMESTAMPTZ,
  result         TEXT,                  -- 'ok' | 'skipped:<reason>' | 'error:<msg>'
  raw_payload    JSONB                  -- full body for debugging surprises
);

-- Cheap lookup by item — used both in debugging and in dedup
CREATE INDEX IF NOT EXISTS monday_events_item_idx
  ON monday_events (monday_item_id, received_at DESC);

-- Cheap lookup by board — used in dashboards
CREATE INDEX IF NOT EXISTS monday_events_board_idx
  ON monday_events (board_id, received_at DESC);

-- RLS on the new table (auth required, same pattern as everything else)
ALTER TABLE monday_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monday_events_select_authenticated"
  ON monday_events FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE policy: writes happen via service_role from our
-- webhook handler, bypassing RLS. Authenticated users can only read.

-- Verify
SELECT
  (SELECT monday_column_ids FROM sites WHERE code = 'aaaf') AS aaaf_cfg,
  (SELECT monday_column_ids FROM sites WHERE code = 'hfa')  AS hfa_cfg;

COMMIT;
