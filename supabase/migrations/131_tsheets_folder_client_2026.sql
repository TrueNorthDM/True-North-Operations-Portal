-- 131_tsheets_folder_client_2026.sql
--
-- The 2026 client an old TSheets top folder's hours report under (owner,
-- 28 October 2026). Without it the same client reads as two across the
-- switch date: "2 - i7 Marketing" before it and "i7 Marketing" after, or
-- "Adventist Messengers/HFA" and "COE Group", in North Time > Reports, on
-- invoices and in Time entries' Hours by client.
--
--   client_2026_id   on a TSheets top folder (structure 1, no parent): the
--                    2026 client (structure 2, level 'client') it belongs to;
--                    empty when it has none, and the old name stays
--
-- Set in Company settings > Job catalogue > Clients > 2026 structure. Emptied
-- if the 2026 client is deleted. Safe to run more than once.

BEGIN;

ALTER TABLE tc_jobcodes ADD COLUMN IF NOT EXISTS client_2026_id INTEGER REFERENCES tc_jobcodes(id) ON DELETE SET NULL;

COMMIT;
