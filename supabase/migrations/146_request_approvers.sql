-- Who approves what (owner, 1 November 2026, Company settings > Invoices):
--
--   reimbursement_approvers   the people who decide reimbursements, chosen in
--                             Company settings. Anyone on it decides (the
--                             first decision closes it), never their own: a
--                             reimbursement of the only person on it goes to
--                             the default approver. Starts with the Deputy
--                             Director (David Sharpe in both databases).
--
-- Time off, its cancellation and extra hours need no column: they follow the
-- invoice rule (invoice_approvers, default_approver) for everyone, in the
-- portal's code (lib/timeclock/routing.ts).
--
-- invoice_settings keeps its protections (migration 115): the server reads
-- and writes it, the anonymous and signed-in roles get nothing. Safe to run
-- again: the list is set only while it is still empty.

BEGIN;

ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS reimbursement_approvers UUID[] NOT NULL DEFAULT '{}';

UPDATE invoice_settings
   SET reimbursement_approvers = ARRAY[deputy_director]
 WHERE singleton_id = 1
   AND deputy_director IS NOT NULL
   AND reimbursement_approvers = '{}';

COMMIT;
