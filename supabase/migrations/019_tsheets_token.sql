-- 019_tsheets_token.sql
--
-- Add tsheets_api_token to the app_settings singleton row.
-- Same pattern as monday_api_token: single static token, stored in the
-- singleton row (singleton_id = 1), never exposed to client components.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS tsheets_api_token TEXT;
