-- Migration 031: per-line budget rate → the i7 monthly $ budget is now DERIVED as
-- Σ(budgeted hours × rate), matching the client's "2026 i7 Daily" sheet.
--
-- The sheet budgets 4 projects at the standard i7 rate ($95, $120 in Jan) plus a
-- lower-rate "Foreign contractors" line (Sam/Nohemi, ~$60/$20) — so the app needs
-- a rate per budget line, not one flat rate. report-data.ts reads this and sums
-- hours × rate; the old flat i7_monthly_budget is now only the fallback (used until
-- this migration runs, so a deploy before it is safe).
--
-- client_id 2 = i7 Marketing (tr_clients where tsheets_jobcode_id = 21152466).

-- 1. Per-line rate. Default $95 so future scaffolded rows are sane; existing rows
--    get $95 too and Jan is corrected to $120 below.
ALTER TABLE i7_project_month_hours ADD COLUMN IF NOT EXISTS rate NUMERIC NOT NULL DEFAULT 95;

-- 2. January 2026 used the $120 standard rate (documented rate anomaly).
UPDATE i7_project_month_hours SET rate = 120 WHERE client_id = 2 AND month = '2026-01-01';

-- 3. Correct Jan–Jun 2026 budgeted hours to the sheet's numbers.
UPDATE i7_project_month_hours SET hours_allocated = 180 WHERE client_id = 2 AND project = 'Wagner Meters (WM)' AND month = '2026-01-01';
UPDATE i7_project_month_hours SET hours_allocated = 125 WHERE client_id = 2 AND project = 'Bessemeter'         AND month = '2026-01-01';
UPDATE i7_project_month_hours SET hours_allocated = 205 WHERE client_id = 2 AND project = 'Wagner Meters (WM)' AND month BETWEEN '2026-02-01' AND '2026-06-01';
UPDATE i7_project_month_hours SET hours_allocated = 202 WHERE client_id = 2 AND project = 'Bessemeter'         AND month BETWEEN '2026-02-01' AND '2026-06-01';

-- 4. The lower-rate contractors budget line (Sam/Nohemi) — budget only, not a
--    report project. Jan: 400h @ $20 · Feb–Jun: 26h @ $60.
INSERT INTO i7_project_month_hours (client_id, project, month, hours_allocated, rate, justification) VALUES
  (2, 'Foreign contractors', '2026-01-01', 400, 20, 'Lower-rate contractors (Sam/Nohemi)'),
  (2, 'Foreign contractors', '2026-02-01',  26, 60, 'Lower-rate contractors (Sam/Nohemi)'),
  (2, 'Foreign contractors', '2026-03-01',  26, 60, 'Lower-rate contractors (Sam/Nohemi)'),
  (2, 'Foreign contractors', '2026-04-01',  26, 60, 'Lower-rate contractors (Sam/Nohemi)'),
  (2, 'Foreign contractors', '2026-05-01',  26, 60, 'Lower-rate contractors (Sam/Nohemi)'),
  (2, 'Foreign contractors', '2026-06-01',  26, 60, 'Lower-rate contractors (Sam/Nohemi)')
ON CONFLICT (client_id, project, month) DO UPDATE SET hours_allocated = EXCLUDED.hours_allocated, rate = EXCLUDED.rate;

-- After this runs, each 2026 month's budget = Σ(hours × rate):
--   Jan     : (40+5+180+125)×120 + 400×20 = $50,000
--   Feb–Jun : (40+10+205+202)×95 + 26×60  = $44,975
-- which matches the sheet, so the running balance / carryover lines up.
