-- 052_app_settings_admin_only.sql
--
-- app_settings holds the Monday API token, the TSheets API token and the Monday
-- webhook signing secret. It already rejected the anon key before this file
-- existed, but nothing in the repo said so: RLS had been switched on by hand in
-- the Supabase dashboard and never written down. Rebuild the database from
-- migrations alone and the table comes back wide open.
--
-- Two things had to change in the app before this could be admin-only, because
-- both read app_settings with the *user's* client from screens regular users
-- can reach, which forced the table to stay readable by every signed-in person:
--
--   * /tools/time-report selected tsheets_api_token only to test whether it was
--     set, then rendered mock data when it wasn't. It never used the value.
--   * /directory (via getBudgetUsageData) selected tsheets_synced_at to show
--     "last synced".
--
-- Both now go through lib/tsheets/status.ts, which reads with the service-role
-- client and returns a boolean and a timestamp, never the secret. After that,
-- every remaining read through a user's session is on an admin-only path
-- (settings page, saveAppSecret, saveSiteWpUrls, syncAllFromTsheets), and the
-- crons and the Monday webhook use service_role, which bypasses RLS.
--
-- The DO block below is deliberate. Whatever policy was clicked into the
-- dashboard is unknown to this repo, and Postgres combines policies with OR:
-- adding a strict policy next to a forgotten permissive one changes nothing.
-- Dropping every existing policy first makes this file the single source of
-- truth for who can touch this table.

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
  LOOP
    EXECUTE format('DROP POLICY %I ON app_settings', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- No read policy for plain authenticated users on purpose: a signed-in team
-- member has no reason to see the API tokens, and the app no longer needs them
-- to. service_role still reads freely, which is how the crons and the webhook
-- get the tokens they call out with.
CREATE POLICY app_settings_admin_read ON app_settings FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY app_settings_admin_write ON app_settings FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
