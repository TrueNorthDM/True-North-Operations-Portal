-- Migration 024: i7 monthly $ budget (the bank-account ledger's inflows).
--
-- The i7 budget changes month to month (Jan $50k, Feb–Jun $45k, Jul–Nov $55k =
-- $50k + $5k makeup, Dec $50k). The carryover is computed as cumulative budget
-- minus cumulative actual cost from January, so only the monthly inflow is
-- stored here — one row per month.

CREATE TABLE IF NOT EXISTS i7_monthly_budget (
  id             SERIAL PRIMARY KEY,
  month          DATE NOT NULL UNIQUE,          -- first of month
  budget_amount  NUMERIC NOT NULL,              -- base $ for the month
  extra_amount   NUMERIC NOT NULL DEFAULT 0,    -- makeup / extra $
  justification  TEXT NOT NULL,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
