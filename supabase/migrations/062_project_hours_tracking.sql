-- 062_project_hours_tracking.sql
--
-- The hours Grants Pass Church and School buy in advance.
--
-- These two projects work unlike i7 and unlike the other donation-funded ones:
-- they say what they want to spend, we invoice, they pay, and that money buys a
-- number of hours at $90. The balance carries month to month and is drawn down
-- as work happens, so a month's remaining hours are:
--
--   remaining(m) = remaining(m-1) + bought(m) - worked(m)
--
-- Everything on the right of that is already in the portal except bought(m),
-- which lives only in a spreadsheet today. This is that column.
--
-- AAAF and Africa (Hope for Africa) have no rows here on purpose. They are
-- funded by donation with no hour allowance, and their balance cells are blank
-- on the tracking sheet too. An empty balance is the honest rendering of a
-- project that does not have one.
--
-- The opening balance is a purchase dated before the reporting window: Church
-- carried 8.50 hours into January 2026 and School 2.56, and the formula above
-- needs no special case to start from those.

CREATE TABLE IF NOT EXISTS tc_project_purchases (
  id            SERIAL PRIMARY KEY,
  -- The "2 Project" value, exactly as it is spelled in QuickBooks Time. Not a
  -- foreign key: the option list is imported and can be re-imported, and a
  -- purchase should survive that.
  project_label TEXT NOT NULL,
  month         TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  hours         NUMERIC(8,2) NOT NULL CHECK (hours >= 0),
  -- What was actually invoiced, kept beside the hours it bought so the two can
  -- be checked against each other later.
  amount_usd    NUMERIC(10,2),
  rate_usd      NUMERIC(8,2) DEFAULT 90,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_label, month)
);
CREATE INDEX IF NOT EXISTS tc_project_purchases_project_idx ON tc_project_purchases (project_label, month);

ALTER TABLE tc_project_purchases ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can open the report, written by admins. The numbers
-- are hours somebody paid for, not personal data.
DROP POLICY IF EXISTS tc_project_purchases_read ON tc_project_purchases;
CREATE POLICY tc_project_purchases_read ON tc_project_purchases
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS tc_project_purchases_admin_write ON tc_project_purchases;
CREATE POLICY tc_project_purchases_admin_write ON tc_project_purchases
  FOR ALL TO authenticated
  USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())));

-- The balances the tracking sheet carried into January 2026, so the report
-- starts from what accounting already has rather than from zero.
INSERT INTO tc_project_purchases (project_label, month, hours, rate_usd, note) VALUES
  ('GP church', '2025-12', 8.50, 90, 'Balance carried into 2026, from the tracking sheet'),
  ('GP School', '2025-12', 2.56, 90, 'Balance carried into 2026, from the tracking sheet'),
  -- School's remaining went from 0.56 to 11.81 in May with nothing worked, so
  -- 11.25 hours were bought that month. Recorded from the sheet; the invoice
  -- amount can be filled in later.
  ('GP School', '2026-05', 11.25, 90, 'From the tracking sheet: remaining went 0.56 to 11.81')
ON CONFLICT (project_label, month) DO NOTHING;
