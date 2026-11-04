-- Salaried employees are outside the hours allowance (leadership, 4 November
-- 2026, David's answers to the rules: "any salaried employee is exempt from
-- this rule"). The allowance applies to hourly employees and contractors.
--
--   pay_terms.salaried   true for a US employee paid a salary (set in Rates &
--                        Costs, Pays as). False for everyone else, contractors
--                        included: a contractor is never salaried. A stored
--                        allowance is kept, and simply not applied while the
--                        person is salaried.
--
-- Also the lunch rule leans on it: hourly employees and contractors clock out
-- for lunch, salaried employees do not have to.

ALTER TABLE pay_terms ADD COLUMN IF NOT EXISTS salaried BOOLEAN NOT NULL DEFAULT false;
