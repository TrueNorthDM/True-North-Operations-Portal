-- Contractors make and send their own invoice (leadership, 4 November 2026,
-- David's answers to the rules: under US labor law, making and submitting the
-- invoice is part of being a contractor, so the portal no longer makes it from
-- the timesheet). Every kind of contractor: hourly, fixed monthly, fixed with
-- no timesheet, and the invoice form's senders. Two ways, both kept on record:
--
--   own_file   the contractor's own PDF, as they sent it, with the number,
--              hours and total they typed so it can be checked
--   builder    the portal's invoice builder (in the portal or on /send): the
--              contractor writes the lines; the portal adds them up and makes
--              the PDF in their name
--
--   invoices.made_by          'own_file' | 'builder'; null for an invoice the
--                             portal made before this change
--   invoices.sent_by          the person who sent it (the contractor); null for
--                             a form sender not in the Directory yet
--   invoices.sent_at          when they sent the version on file
--   invoices.sent_from        'portal' | 'form'
--   invoices.confirmed_text   the sentence they ticked: "This is my invoice..."
--   invoices.their_number     their own invoice number, when they have one
--   invoices.stated_hours     the hours their invoice says (own file; the
--                             builder's lines say it themselves)
--   invoices.stated_total     the total their invoice says (own file)
--   invoices.covers           what an own-file invoice covers, in their words
--
--   invoice_sends             every version a contractor sent, the first and
--                             each one after a return: who, when, how, what
--                             they typed, their file and their lines. The
--                             invoice row holds the latest; this keeps them all
--                             (the record page of the PDF and the history).
--
-- A timesheet's invoice no longer exists until the contractor sends it: the
-- hours can be approved before it arrives, and the invoice step waits for it.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS made_by TEXT CHECK (made_by IS NULL OR made_by IN ('own_file', 'builder'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES people(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_from TEXT CHECK (sent_from IS NULL OR sent_from IN ('portal', 'form'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS confirmed_text TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS their_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stated_hours NUMERIC(10,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stated_total NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS covers TEXT;

CREATE TABLE IF NOT EXISTS invoice_sends (
  id             BIGSERIAL PRIMARY KEY,
  invoice_id     BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  made_by        TEXT NOT NULL CHECK (made_by IN ('own_file', 'builder')),
  sent_from      TEXT NOT NULL CHECK (sent_from IN ('portal', 'form')),
  sent_by        UUID REFERENCES people(id),
  sent_email     TEXT,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_text TEXT NOT NULL,
  their_number   TEXT,
  stated_hours   NUMERIC(10,2),
  stated_total   NUMERIC(12,2),
  covers         TEXT,
  own_pdf_path   TEXT,
  own_pdf_name   TEXT,
  -- The builder's lines as they wrote them: [{kind, client, description, hours_seconds, rate, amount}].
  lines          JSONB NOT NULL DEFAULT '[]'::jsonb,
  total          NUMERIC(12,2)
);
CREATE INDEX IF NOT EXISTS invoice_sends_invoice_idx ON invoice_sends (invoice_id, sent_at);

-- Money: the same lock as the invoices (migration 115): only the server reads it.
ALTER TABLE invoice_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON invoice_sends FROM anon, authenticated;
REVOKE ALL ON SEQUENCE invoice_sends_id_seq FROM anon, authenticated;

-- db_protections_check watches the new table too (as in migration 148, plus invoice_sends).
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
                        'invoice_sends']) t,
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
