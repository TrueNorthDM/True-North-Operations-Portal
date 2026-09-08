-- 079_project_donations.sql
--
-- The money that arrives for a project, which no system holds.
--
-- Asked directly, the Admin Assistant said: "I will need to manually enter the
-- donations as there isn't a way to add that in the workflow. The figures come
-- from checks and online donations." There is no accounting or donor platform
-- to read, and QuickBooks Time carries hours only. So this is a table people
-- type into, and the screen that does it is the only writer.
--
-- Two kinds, which is why the project is nullable rather than required:
--
--   "Donations are not all for just AAAF. If the donor requests the donations
--    go to AAAF that's where they go, otherwise the donation goes under
--    unrestricted and used for all projects."
--
-- A restricted donation names a project. An unrestricted one names none, and
-- belongs to no row of a report laid out by project, so it gets a row of its
-- own rather than being divided across the four. Splitting it would invent an
-- allocation nobody asked for.
--
-- Unlike tc_project_purchases, none of this converts to hours: "It doesn't
-- translate into hours for this purpose." It is money and stays money.
--
-- One row per bucket per month, not one per donation. She totals the cheques
-- and the online payments before writing them down, and donor-level records
-- would be a larger table serving reporting nobody has asked for. If donor
-- history is ever wanted, this is what it would be summarised into.

CREATE TABLE IF NOT EXISTS tc_project_donations (
  id            SERIAL PRIMARY KEY,
  -- The "2 Project" label, spelled as tc_project_purchases spells it, or NULL
  -- for unrestricted. Not a foreign key, for the same reason purchases is not:
  -- the option list is imported and can be re-imported, and a donation that
  -- has already been banked should survive that.
  project_label TEXT,
  month         TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  amount_usd    NUMERIC(12,2) NOT NULL CHECK (amount_usd >= 0),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per bucket per month, enforced. UNIQUE would not do it: in SQL two
-- NULLs are not equal, so it would happily accept a second unrestricted row for
-- the same month and the report would show whichever it read first.
CREATE UNIQUE INDEX IF NOT EXISTS tc_project_donations_restricted_idx
  ON tc_project_donations (project_label, month) WHERE project_label IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tc_project_donations_unrestricted_idx
  ON tc_project_donations (month) WHERE project_label IS NULL;

ALTER TABLE tc_project_donations ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can open the report. These are sums of money given to
-- the organisation, not personal data, and no donor is named here.
DROP POLICY IF EXISTS tc_project_donations_read ON tc_project_donations;
CREATE POLICY tc_project_donations_read ON tc_project_donations
  FOR SELECT TO authenticated USING (true);

-- Written by the privileged tiers, which is admins AND the Admin Assistant.
--
-- is_admin() is enough for both, and that is not obvious: it reads
-- profiles.role, and migration 038 set that to 'admin' for role_type
-- 'admin_assistant' as well. So the person who actually holds these figures can
-- already write them, and no widening is needed here. The gate that WOULD have
-- shut her out is in the app: access.isAdmin is roleType === 'admin' exactly,
-- so the entry screen has to check isPrivileged instead.
DROP POLICY IF EXISTS tc_project_donations_write ON tc_project_donations;
CREATE POLICY tc_project_donations_write ON tc_project_donations
  FOR ALL TO authenticated
  USING ((SELECT is_admin(auth.uid()))) WITH CHECK ((SELECT is_admin(auth.uid())));

-- tc_project_purchases is deliberately left alone. It has had a working policy
-- since migration 062 and the same is_admin() reach; what it has never had is a
-- way to write to it from the portal, so every Grants Pass purchase has been a
-- hand-written INSERT. That is a screen, not a policy, and the screen is coming
-- with this change.
