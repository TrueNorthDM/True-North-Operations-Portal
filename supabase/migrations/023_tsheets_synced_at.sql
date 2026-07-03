-- Migration 023: record when the TSheets sync last ran.
--
-- The sync (job codes → tr_clients, users → people) now runs automatically on a
-- Vercel Cron. Stamp app_settings so the UI can show "Last synced X ago" and
-- drop the manual sync buttons.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS tsheets_synced_at TIMESTAMPTZ;
