-- Migration 022: separate validity periods for the budget vs the extra budget.
--
-- Until now a budget row had a single start_date. Ops needs the base budget and
-- the extra (top-up) budget to carry INDEPENDENT periods — e.g. a base budget
-- that runs open-ended while an extra allocation covers only a few months.
--
-- start_date stays the base budget's start (required) and the key the
-- "new budget closes the previous" versioning is built on. end_date stays the
-- INTERNAL supersession marker (set when a newer row replaces this one) — it is
-- not the user-facing budget end. These three columns are the user-facing dates.

ALTER TABLE tr_budgets
  ADD COLUMN IF NOT EXISTS budget_end_date  DATE,   -- base budget end   (NULL = ongoing)
  ADD COLUMN IF NOT EXISTS extra_start_date DATE,   -- extra budget start (set when extra_budget > 0)
  ADD COLUMN IF NOT EXISTS extra_end_date   DATE;   -- extra budget end   (NULL = ongoing)
