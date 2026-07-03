-- Migration 023: record the TSheets parent for each cached job code.
--
-- tr_clients was synced flat from ALL TSheets job codes — parents (real clients
-- like "i7 Marketing") AND their children (activities like "Content", "SEO",
-- duplicated across clients). Budgets and rates only make sense at the CLIENT
-- (top-level) level, so we tag each row with its parent and let the settings
-- screens show only top-level clients (parent_id IS NULL).
--
-- Populated by the next "Sync clients from TSheets" run (syncTrClients writes
-- parent_id; TSheets' top-level 0 is normalised to NULL).

ALTER TABLE tr_clients
  ADD COLUMN IF NOT EXISTS parent_id INT;   -- TSheets parent jobcode id; NULL = top-level client
