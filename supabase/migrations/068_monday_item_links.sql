-- 068_monday_item_links.sql
--
-- What a link to a Monday item needs, and does not have yet.
--
-- A Monday item lives at https://<slug>.monday.com/boards/<board>/pulses/<item>.
-- Two pieces of that are missing here:
--
--   the slug   account-level, known only from the API, and not worth hardcoding
--              in the source: the day it changes the links break silently and
--              nobody connects the two.
--
--   the parent board   a subitem sits on a board of its own ("Subitems of X"),
--              and that board is not navigable in Monday's interface. Opening a
--              subitem means opening its PARENT, on the parent's board, which
--              is an id this table never captured because nothing needed it
--              until now.

BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS monday_account_slug TEXT;

COMMENT ON COLUMN app_settings.monday_account_slug IS
  'Subdomain of the Monday account, filled by discovery. Only used to build item links.';

ALTER TABLE monday_assignments
  ADD COLUMN IF NOT EXISTS parent_board_id BIGINT;

COMMIT;
