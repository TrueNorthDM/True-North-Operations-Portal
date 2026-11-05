-- Reimbursement requests while they wait (owner, 5 November 2026, from
-- Tina's feedback as Finance):
--
--   Edit or withdraw   while every receipt of a request is still waiting, the
--                      person who asked may change it (date, category,
--                      amount or miles, description, client, billable; a
--                      receipt replaced, added or removed) or withdraw it,
--                      with a reason if they like. Same checks as a new
--                      request, on the server.
--   One per event      a request sent with the name of an event or trip the
--                      person already has waiting joins it, so its decider
--                      approves the whole event at once.
--
--   reimbursements.state             also 'withdrawn': the person took it back
--                                    before a decision. It leaves Approvals and
--                                    shows "Withdrawn" in their list.
--   reimbursements.withdrawn_at      when, and
--   reimbursements.withdrawn_reason  why, in their words (optional).
--
--   reimbursement_changes   every change to a waiting request: who, when, what
--                           (edited, receipt added, receipt removed, receipts
--                           joined from a new request, withdrawn), with each
--                           receipt's values before and after. A removed
--                           receipt's row is deleted; its values stay here.
--
-- As 116 and 122: server writes only, nothing for the anonymous or signed-in
-- role, watched by the daily check. Safe to run again.

BEGIN;

ALTER TABLE reimbursements DROP CONSTRAINT IF EXISTS reimbursements_state_check;
ALTER TABLE reimbursements ADD CONSTRAINT reimbursements_state_check
  CHECK (state IN ('pending', 'approved', 'denied', 'on_invoice', 'paid', 'withdrawn'));

ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;
COMMENT ON COLUMN reimbursements.withdrawn_at IS 'When its person withdrew it, before any decision (state withdrawn).';
COMMENT ON COLUMN reimbursements.withdrawn_reason IS 'Why they withdrew it, in their words; optional.';

CREATE TABLE IF NOT EXISTS reimbursement_changes (
  id                BIGSERIAL PRIMARY KEY,
  -- Whose request it is, and who changed it (the same person: only they may).
  person_id         UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  changed_by        UUID REFERENCES people(id) ON DELETE SET NULL,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  action            TEXT NOT NULL CHECK (action IN ('edited', 'receipt_added', 'receipt_removed', 'joined', 'withdrawn')),
  -- The request (null for one receipt with no name) and the receipt; no foreign
  -- key on the receipt, so a removed one keeps its id here.
  report_id         BIGINT REFERENCES reimbursement_reports(id) ON DELETE SET NULL,
  reimbursement_id  BIGINT,
  -- The receipt's values before and after: date, category, amount, currency,
  -- description, client, billable, miles, receipt number and file name.
  before            JSONB,
  after             JSONB,
  reason            TEXT
);
CREATE INDEX IF NOT EXISTS reimbursement_changes_person_idx ON reimbursement_changes (person_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS reimbursement_changes_item_idx ON reimbursement_changes (reimbursement_id) WHERE reimbursement_id IS NOT NULL;

-- Money: the same lock as the reimbursements (migration 116): only the server reads it.
ALTER TABLE reimbursement_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reimbursement_changes FROM anon, authenticated;
REVOKE ALL ON SEQUENCE reimbursement_changes_id_seq FROM anon, authenticated;

COMMIT;

-- db_protections_check watches the new table too (as in migration 152, plus reimbursement_changes).
CREATE OR REPLACE FUNCTION public.db_protections_check()
RETURNS TEXT[]
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(problem ORDER BY problem), '{}') FROM (
    SELECT 'people.' || c || ' readable by ' || r AS problem
      FROM unnest(ARRAY['internal_rate','monthly_salary','be_rate','address','date_of_birth','email_personal','phone']) c,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.people', c, 'SELECT')
    UNION ALL
    SELECT 'tr_assignments.hourly_rate readable by ' || r
      FROM unnest(ARRAY['anon','authenticated']) r
     WHERE has_column_privilege(r, 'public.tr_assignments', 'hourly_rate', 'SELECT')
    UNION ALL
    SELECT t || ' readable by ' || r
      FROM unnest(ARRAY['monday_assignments','monday_assignment_events','monday_board_steps','monday_boards',
                        'monday_users','monday_user_links','monday_team_priority','monday_priority_grants',
                        'monday_snapshot','publishing_targets','publishing_target_periods','publishing_publishers',
                        'sites','pages','page_urls','confirmations','monday_events',
                        'app_settings','settings_change_log',
                        'tc_correction_requests','tc_combinations','tc_person_cadence',
                        'tc_pay_period_anchors','tc_safety_events',
                        'pay_terms','pay_terms_changes','tc_approval_events','invoices','invoice_lines',
                        'invoice_settings','reimbursement_documents','reimbursements','extra_hours_requests',
                        'integration_jobs','people_type_changes','agenda_events',
                        'agenda_accounts','agenda_person_settings','agenda_busy','agenda_event_guests',
                        'agenda_booking_links','agenda_bookings','agenda_account_tokens',
                        'reimbursement_reports','invoice_form_codes','invoice_form_submissions',
                        'hr_settings','review_cycles','review_priorities','review_team_priorities','reviews',
                        'review_answers','review_goals','review_goal_updates','review_checkins',
                        'review_imports','review_log','review_notices',
                        'invoice_sends','reimbursement_changes']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'SELECT')
    UNION ALL
    SELECT t || ' writable by ' || r
      FROM unnest(ARRAY['tc_entries','tc_submissions','tc_absence_requests','tc_entry_audit',
                        'tc_periods','tc_settings']) t,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_table_privilege(r, 'public.' || t, 'INSERT')
        OR has_table_privilege(r, 'public.' || t, 'UPDATE')
        OR has_table_privilege(r, 'public.' || t, 'DELETE')
    UNION ALL
    SELECT f || ' callable by ' || r
      FROM unnest(ARRAY['merge_people(uuid,uuid)','merge_monday_links(uuid,uuid)','portal_can_sign_in(text)',
                        'portal_end_sessions(uuid)','portal_two_step_status(uuid)',
                        'monday_swap_board_assignments(bigint,uuid)','access_commit(jsonb,jsonb,jsonb)',
                        'set_person_teams(uuid,jsonb)',
                        'report_counted_events(bigint[])','report_span_events(bigint[],timestamptz)',
                        'report_open_since(bigint[])','report_flow_events(bigint[],timestamptz)',
                        'report_hours(uuid[],date)','report_jobcode_hours(integer[],date)',
                        'report_person_hours(uuid,date)',
                        'monday_write_board(bigint,uuid,jsonb)','monday_assignment_counts()',
                        'publishing_set_target(text,text,text,integer,text,date)',
                        'publishing_remove_target(uuid,text,date)',
                        'prune_monday_events()',
                        'my_work_list(bigint[],bigint[],bigint[],boolean,timestamptz,integer)',
                        'tc_job_field_defaults(date,text[])','next_document_number(text)',
                        'agenda_booking_hold(uuid,timestamptz,timestamptz,integer,text,text,text[],text,text,text,text,timestamptz)',
                        'agenda_booking_confirm(text,integer)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

NOTIFY pgrst, 'reload schema';
