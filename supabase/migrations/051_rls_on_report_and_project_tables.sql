-- 051_rls_on_report_and_project_tables.sql
--
-- Closes a live data leak. Thirteen tables had no RLS declared in any
-- migration, and seven of them were readable AND writable by anyone on the
-- internet using the public `anon` key that ships in the browser bundle.
--
-- Verified from outside the app, unauthenticated, before this migration:
--
--   tsheets_timesheets       2074 rows   every hour logged, per person, per day
--   tr_assignments             40 rows   hourly_rate per person
--   tr_clients                 21 rows   client list + TSheets jobcode ids
--   tr_budgets                  1 row    budget_amount, extra_budget
--   i7_monthly_budget          12 rows   monthly budget + justifications
--   i7_project_month_hours    102 rows   hours allocated per project
--   i7_report_notes             1 row
--   tr_audit_log                5 rows   before/after of every budget change
--
-- A no-op UPDATE on tr_clients (writing back the value already stored) was
-- accepted and returned the row, so writes were open too.
--
-- ROOT CAUSE. Not a wrong policy: a missing one. These tables were added later
-- than the ones in 007/008/012/014, copying their column style but not the RLS
-- block at the end of those files. Nothing in the app behaves differently with
-- or without RLS, so it stayed invisible. src/lib/tsheets/require-admin.ts even
-- documents the guard as "writes are also protected by RLS (is_admin)", which
-- was the intent all along and is what this migration finally makes true.
--
-- WHY THESE POLICIES. Every access path was traced before writing them, so the
-- rules below encode what the code already enforces rather than inventing a new
-- posture:
--
--   * Reads run as `authenticated` from Server Components (report-data.ts,
--     budget-usage-data.ts). budget-usage-data feeds BOTH /settings (admin) and
--     /directory (not admin), so SELECT has to stay open to authenticated or
--     the Directory breaks for regular users.
--   * Writes to the money/HR tables all pass requireAdmin() -> isSecurityAdmin()
--     first (11 actions in settings-actions.ts, plus syncAllFromTsheets), so an
--     admin-only write policy changes nothing for anyone.
--   * Writes to pages/page_urls/confirmations/sites are day-to-day work done by
--     regular users (confirm a page, pause a language, save URLs) and are
--     deliberately ungated in code, so those stay open to authenticated.
--   * The crons and the Monday webhook use createAdminClient() (service_role),
--     which bypasses RLS entirely. None of them are affected.
--
-- NOT IN SCOPE: app_settings. It already rejects anon, but nothing declares
-- that here and it is unclear whether the existing rule is admin-only or all
-- authenticated. Adding a policy could only widen it, and the real fix is a
-- code change (time-report/page.tsx reads tsheets_api_token with the user's
-- client; it should use the admin client) so app_settings can be admin-only.
-- Left alone deliberately rather than guessed at.
--
-- Re-verify after applying, from a terminal, with the public anon key:
--   curl "$URL/rest/v1/tr_budgets?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
-- Every one of the seven tables above must come back [].

-- ─── Money and HR data: everyone signed in reads, only admins write ──────────
-- Matches the requireAdmin() gate already present on every write path.

ALTER TABLE tr_clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tr_budgets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tr_project_budgets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tr_assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tr_audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsheets_timesheets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE i7_monthly_budget      ENABLE ROW LEVEL SECURITY;
ALTER TABLE i7_project_month_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE i7_report_notes        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tr_clients_read ON tr_clients;
CREATE POLICY tr_clients_read ON tr_clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tr_clients_admin_write ON tr_clients;
CREATE POLICY tr_clients_admin_write ON tr_clients FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS tr_budgets_read ON tr_budgets;
CREATE POLICY tr_budgets_read ON tr_budgets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tr_budgets_admin_write ON tr_budgets;
CREATE POLICY tr_budgets_admin_write ON tr_budgets FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS tr_project_budgets_read ON tr_project_budgets;
CREATE POLICY tr_project_budgets_read ON tr_project_budgets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tr_project_budgets_admin_write ON tr_project_budgets;
CREATE POLICY tr_project_budgets_admin_write ON tr_project_budgets FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS tr_assignments_read ON tr_assignments;
CREATE POLICY tr_assignments_read ON tr_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tr_assignments_admin_write ON tr_assignments;
CREATE POLICY tr_assignments_admin_write ON tr_assignments FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS tr_audit_log_read ON tr_audit_log;
CREATE POLICY tr_audit_log_read ON tr_audit_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tr_audit_log_admin_write ON tr_audit_log;
CREATE POLICY tr_audit_log_admin_write ON tr_audit_log FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS tsheets_timesheets_read ON tsheets_timesheets;
CREATE POLICY tsheets_timesheets_read ON tsheets_timesheets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tsheets_timesheets_admin_write ON tsheets_timesheets;
CREATE POLICY tsheets_timesheets_admin_write ON tsheets_timesheets FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS i7_monthly_budget_read ON i7_monthly_budget;
CREATE POLICY i7_monthly_budget_read ON i7_monthly_budget FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS i7_monthly_budget_admin_write ON i7_monthly_budget;
CREATE POLICY i7_monthly_budget_admin_write ON i7_monthly_budget FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS i7_project_month_hours_read ON i7_project_month_hours;
CREATE POLICY i7_project_month_hours_read ON i7_project_month_hours FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS i7_project_month_hours_admin_write ON i7_project_month_hours;
CREATE POLICY i7_project_month_hours_admin_write ON i7_project_month_hours FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS i7_report_notes_read ON i7_report_notes;
CREATE POLICY i7_report_notes_read ON i7_report_notes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS i7_report_notes_admin_write ON i7_report_notes;
CREATE POLICY i7_report_notes_admin_write ON i7_report_notes FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ─── Project workflow: everyone signed in reads and writes ───────────────────
-- Confirming a page, pausing a language, saving URLs and toggling confirmations
-- are normal work for regular users, and the server actions behind them carry
-- no admin gate on purpose. Restricting writes here would break /projects for
-- everyone who is not an admin. These tables were already rejecting anon before
-- this migration; declaring them keeps that true if the DB is ever rebuilt from
-- migrations alone, which is where the drift risk lives.

ALTER TABLE sites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_urls     ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sites_read ON sites;
CREATE POLICY sites_read ON sites FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sites_write ON sites;
CREATE POLICY sites_write ON sites FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pages_read ON pages;
CREATE POLICY pages_read ON pages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pages_write ON pages;
CREATE POLICY pages_write ON pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS page_urls_read ON page_urls;
CREATE POLICY page_urls_read ON page_urls FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS page_urls_write ON page_urls;
CREATE POLICY page_urls_write ON page_urls FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS confirmations_read ON confirmations;
CREATE POLICY confirmations_read ON confirmations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS confirmations_write ON confirmations;
CREATE POLICY confirmations_write ON confirmations FOR ALL TO authenticated USING (true) WITH CHECK (true);
