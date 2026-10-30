-- Mileage on reimbursements (Tina's review, 29 October 2026). The portal
-- replaces her Drive spreadsheet, whose mileage block is the total miles times
-- a rate per mile ($0.76), with no receipt.
--
--   invoice_settings.mileage_rate  dollars a mile, set in Company settings >
--                                  Invoices by a Super Admin.
--   reimbursements.miles           the miles of a Mileage line; its amount is
--                                  the miles times the rate, worked out by the
--                                  portal when the request is sent.
--   reimbursements.mileage_rate    the rate the line was sent with, so a later
--                                  change of rate never changes it.
--   reimbursements.receipt_path    may be empty: a Mileage line needs no
--                                  receipt (every other category still does,
--                                  checked when the request is sent).

BEGIN;

ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS mileage_rate NUMERIC(6,3) NOT NULL DEFAULT 0.76;
COMMENT ON COLUMN invoice_settings.mileage_rate IS 'Dollars a mile for a Mileage reimbursement (Company settings > Invoices).';

ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS miles NUMERIC(8,1);
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS mileage_rate NUMERIC(6,3);
COMMENT ON COLUMN reimbursements.miles IS 'A Mileage line''s miles; its amount is miles times mileage_rate.';
COMMENT ON COLUMN reimbursements.mileage_rate IS 'The rate a Mileage line was sent with (invoice_settings.mileage_rate then).';

ALTER TABLE reimbursements ALTER COLUMN receipt_path DROP NOT NULL;
COMMENT ON COLUMN reimbursements.receipt_path IS 'The receipt in the private receipts bucket; empty only for a Mileage line sent without one.';

COMMIT;
