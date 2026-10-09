-- 101_client_reports_safety.sql
--
-- Three guards for the client reports (audit, 9 October 2026, module 7):
--
-- 1. Hours added by hand from a report (i7 or Project Hours) carry the batch
--    they were added in. The panel used to list and delete every
--    `kind = 'manual'` row with no QuickBooks id, which also matched a
--    person's own duration-only entries from My Hours, approved ones
--    included. Now the panel reads and deletes only rows it added itself
--    (manual_batch set). And a batch sent twice (a double click, a retry after
--    a timeout) cannot land twice: (manual_batch, manual_line) is unique, so a
--    repeat is refused instead of billing the client again.
--
--    The rows already added by the panel are marked: hand-added hours with no
--    QuickBooks id, entered by someone other than the person they are for.
--    A person's own My Hours entries have created_by = person_id and stay
--    unmarked.
--
-- 2. Prepaid hour purchases get the history donations already have
--    (migration 080): who changed which figure, from what to what. The
--    purchases were written in place with nothing left behind.

BEGIN;

ALTER TABLE tc_entries ADD COLUMN IF NOT EXISTS manual_batch UUID;
ALTER TABLE tc_entries ADD COLUMN IF NOT EXISTS manual_line  INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS tc_entries_manual_batch_line
  ON tc_entries (manual_batch, manual_line)
  WHERE manual_batch IS NOT NULL;

UPDATE tc_entries
   SET manual_batch = gen_random_uuid(), manual_line = 0
 WHERE manual_batch IS NULL
   AND kind = 'manual'
   AND external_id IS NULL
   AND created_by IS DISTINCT FROM person_id;

CREATE TABLE IF NOT EXISTS tc_project_purchases_log (
  id              SERIAL PRIMARY KEY,
  -- Not a foreign key, as in 080: a delete must leave its own entry standing.
  purchase_id     INTEGER,
  project_label   TEXT,
  month           TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  action          TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  hours_before    NUMERIC(8,2),
  hours_after     NUMERIC(8,2),
  amount_before   NUMERIC(10,2),
  amount_after    NUMERIC(10,2),
  note_before     TEXT,
  note_after      TEXT,
  actor_person_id UUID,
  actor_name      TEXT,
  actor_email     TEXT,
  at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tc_project_purchases_log_at_idx ON tc_project_purchases_log (at DESC);

-- Read and written only by the server (the service role), like every client
-- report table: row-level security on, and no rule for the signed-in role.
ALTER TABLE tc_project_purchases_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tc_project_purchases_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE tc_project_purchases_log_id_seq FROM anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
