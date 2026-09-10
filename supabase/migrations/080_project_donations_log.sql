-- 080_project_donations_log.sql
--
-- Every change to a donation figure, kept.
--
-- tc_project_donations holds one row per project per month and saveDonation
-- writes it in place, so correcting $500 to $700 left nothing behind: not the
-- old figure, not who changed it, not when. Asked whether the history was
-- recorded, the honest answer was no. This is that answer being fixed.
--
-- Why a separate table rather than columns on the donation:
--
--   A donation row answers "what is the figure now". A log answers "what has
--   this figure been". The second needs a row per change and the first needs a
--   row per month, so they are different shapes and one table cannot be both.
--
-- Why the actor is written as name and email rather than only a foreign key:
--
--   A log records what was true when it happened. Someone leaves, their people
--   row is archived or renamed, and a join would then rewrite history or lose
--   it. The person id is kept beside them for linking while it still resolves,
--   but the readable identity does not depend on it.
--
-- What this does NOT catch: a figure edited directly in the Supabase table
-- editor. The writes are made with the service-role client, so the database
-- cannot see who the person is (auth.uid() is null there) and a trigger could
-- only record an anonymous change. The application knows the person, so the
-- application writes the log. The screen is the only writer the product
-- offers, which is the same assumption 079 already documented.

CREATE TABLE IF NOT EXISTS tc_project_donations_log (
  id              SERIAL PRIMARY KEY,
  -- The donation row this concerned. Deliberately not a foreign key: a delete
  -- must leave its own log entry standing, and ON DELETE SET NULL would erase
  -- the one link that says which row it was.
  donation_id     INTEGER,
  -- Repeated from the donation so the entry reads on its own after a delete.
  project_label   TEXT,
  month           TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  action          TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  -- NULL on create, since there was nothing before; NULL after on delete.
  amount_before   NUMERIC(12,2),
  amount_after    NUMERIC(12,2),
  note_before     TEXT,
  note_after      TEXT,
  -- Who. The id links while it resolves, the name and email survive it.
  actor_person_id UUID,
  actor_name      TEXT,
  actor_email     TEXT,
  at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The ledger reads newest first, and filters by month when showing one year.
CREATE INDEX IF NOT EXISTS tc_project_donations_log_at_idx
  ON tc_project_donations_log (at DESC);
CREATE INDEX IF NOT EXISTS tc_project_donations_log_month_idx
  ON tc_project_donations_log (month);

ALTER TABLE tc_project_donations_log ENABLE ROW LEVEL SECURITY;

-- Narrower than the donations themselves, deliberately.
--
-- The figures are readable by anyone who can open the report: they are sums of
-- money, and 079 said so. This says who typed them, which is a record about
-- staff rather than about money, so it stays with the tier that may write them.
-- The application reads it with the service-role client and gates in app code,
-- as every client report does, so this policy is the floor and not the gate.
DROP POLICY IF EXISTS tc_project_donations_log_read ON tc_project_donations_log;
-- Spelled exactly as 079 spells it, parameter included: the function takes a
-- uuid, and is_admin() with no argument does not exist. That is the shape this
-- database has, proven by 079 having applied.
CREATE POLICY tc_project_donations_log_read ON tc_project_donations_log
  FOR SELECT TO authenticated USING ((SELECT is_admin(auth.uid())));

-- Nothing may edit or remove a log entry. An audit trail that can be rewritten
-- is not one, and there is no product reason to correct an entry: a wrong
-- figure is fixed by changing the donation, which writes another entry.
DROP POLICY IF EXISTS tc_project_donations_log_no_update ON tc_project_donations_log;
DROP POLICY IF EXISTS tc_project_donations_log_no_delete ON tc_project_donations_log;

-- The seven months imported from the tracking sheet in September 2026 predate
-- this table. Backfilled as 'created' so the ledger is complete rather than
-- starting mid-story, and attributed to the import rather than to a person,
-- because no person typed them.
INSERT INTO tc_project_donations_log
  (donation_id, project_label, month, action, amount_after, note_after, actor_name, at)
SELECT d.id, d.project_label, d.month, 'created', d.amount_usd, d.note,
       'Imported from the tracking sheet', d.created_at
FROM tc_project_donations d
WHERE NOT EXISTS (
  SELECT 1 FROM tc_project_donations_log l WHERE l.donation_id = d.id
);
