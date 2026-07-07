-- Migration 026: per-month budgeted hours per i7 project.
--
-- The i7 report's "Budget hrs / Hrs avail." guide used to be a single value per
-- project (tr_project_budgets, effective-dated). To let it vary month to month —
-- edited as a project × month matrix in Settings and read per selected month by
-- the report — hours are now stored one row per (client, project, month), the
-- same shape as i7_monthly_budget.

CREATE TABLE IF NOT EXISTS i7_project_month_hours (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES tr_clients(id),
  project         TEXT NOT NULL,
  month           DATE NOT NULL,                 -- first of month
  hours_allocated NUMERIC NOT NULL,
  justification   TEXT NOT NULL,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, project, month)
);

CREATE INDEX IF NOT EXISTS i7_project_month_hours_month_idx ON i7_project_month_hours (month);
