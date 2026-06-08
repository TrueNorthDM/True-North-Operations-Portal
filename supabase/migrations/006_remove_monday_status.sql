-- 006_remove_monday_status.sql
-- Removes the Monday/WordPress implementation-status mirror from `pages`.
-- The "Monday tracking" UI (detail section, list column, header badge) and the
-- doneHandler writes to these columns were removed. No application code
-- references them as of this migration.
--
-- Kept intact: the Href Link flow (Run Link → URL → Apply Link), the
-- confirmations/hreflang side, and pages.confirmed_done_at. Also kept:
-- monday_item_id / monday_item_name (the item linkage, unrelated to status).
--
-- DESTRUCTIVE: drops the columns and any data they held. Irreversible.
-- Apply ONLY after the code that stops selecting these columns is deployed,
-- otherwise the live PostgREST `.select(...monday_status...)` queries will error.

ALTER TABLE pages
  DROP COLUMN IF EXISTS monday_status,
  DROP COLUMN IF EXISTS monday_lang_status;
