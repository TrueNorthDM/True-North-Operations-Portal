-- Migration 032: which i7 projects each person works on (the budget "roster").
--
-- Each project's budget rate is the AVERAGE i7 billing rate of the people assigned
-- to it, so we need to know who's on each project. Edited in Settings → People &
-- rates (a multi-select), read by the budget's per-project average rate.
-- Values are the i7 project names (see I7_PROJECTS in lib/tsheets/i7report.ts):
--   'i7 Marketing', 'Moisture Meters (MME)', 'Wagner Meters (WM)', 'Bessemeter'.

ALTER TABLE people ADD COLUMN IF NOT EXISTS i7_projects text[] NOT NULL DEFAULT '{}';
