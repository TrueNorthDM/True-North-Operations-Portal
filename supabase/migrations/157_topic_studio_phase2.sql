-- 157_topic_studio_phase2.sql
--
-- Topic Studio, phase 2, the writer workshop (owner, 6 November 2026). Safe to
-- run again. Server only, as 155 and 156: RLS on, nothing for the anonymous or
-- signed-in role, watched by the daily check.
--
--   ts_drafts          the article draft of a topic, one per topic, as the
--                      editor's clean HTML (the server sanitizes it again before
--                      it gets here). `version` counts saves: a save names the
--                      version it started from and is refused when someone else
--                      saved since, so two people never overwrite each other
--                      without being told.
--   ts_draft_versions  snapshots of a draft the writer can go back to: saved by
--                      hand, automatic (every 30 minutes of editing) or taken
--                      before a restore. The newest 40 are kept per topic.
--   ts_feedback        what a writer says about a topic's term list (good, or has
--                      problems, with a note), for the SEO team to read.
--
--   ts_save_draft      the draft save with the version check; returns
--                      { ok, version, updated_at } or { ok: false, version }.
--   ts_add_version     adds a snapshot and prunes (automatic ones go first).

BEGIN;

CREATE TABLE IF NOT EXISTS ts_drafts (
  topic_id    UUID PRIMARY KEY REFERENCES ts_topics(id) ON DELETE CASCADE,
  html        TEXT NOT NULL DEFAULT '',
  version     INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES people(id) ON DELETE SET NULL
);
COMMENT ON TABLE ts_drafts IS 'Topic Studio: the draft of a topic (clean HTML), with a save counter for the conflict check.';

CREATE TABLE IF NOT EXISTS ts_draft_versions (
  id        BIGSERIAL PRIMARY KEY,
  topic_id  UUID NOT NULL REFERENCES ts_topics(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by  UUID REFERENCES people(id) ON DELETE SET NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('saved', 'auto', 'restore')),
  note      TEXT NOT NULL DEFAULT '',
  html      TEXT NOT NULL,
  words     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ts_draft_versions_topic_idx ON ts_draft_versions (topic_id, saved_at DESC);
COMMENT ON TABLE ts_draft_versions IS 'Topic Studio: snapshots of a draft, newest 40 per topic.';

CREATE TABLE IF NOT EXISTS ts_feedback (
  id           BIGSERIAL PRIMARY KEY,
  topic_id     UUID NOT NULL REFERENCES ts_topics(id) ON DELETE CASCADE,
  person_id    UUID REFERENCES people(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL DEFAULT 'terms' CHECK (kind IN ('terms')),
  rating       TEXT NOT NULL CHECK (rating IN ('good', 'problems')),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES people(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ts_feedback_topic_idx ON ts_feedback (topic_id, created_at DESC);
COMMENT ON TABLE ts_feedback IS 'Topic Studio: what a writer says about a topic''s term list.';

ALTER TABLE ts_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ts_drafts, ts_draft_versions, ts_feedback FROM anon, authenticated;
REVOKE ALL ON SEQUENCE ts_draft_versions_id_seq, ts_feedback_id_seq FROM anon, authenticated;

-- Saves the draft when the caller started from the current version.
CREATE OR REPLACE FUNCTION public.ts_save_draft(p_topic UUID, p_html TEXT, p_base INTEGER, p_actor UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur ts_drafts;
  stamp TIMESTAMPTZ := now();
BEGIN
  PERFORM 1 FROM ts_topics t WHERE t.id = p_topic FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'topic_not_found'; END IF;
  SELECT * INTO cur FROM ts_drafts d WHERE d.topic_id = p_topic;
  IF NOT FOUND THEN
    IF COALESCE(p_base, 0) <> 0 THEN RETURN jsonb_build_object('ok', false, 'version', 0); END IF;
    INSERT INTO ts_drafts (topic_id, html, version, updated_at, updated_by) VALUES (p_topic, p_html, 1, stamp, p_actor);
    RETURN jsonb_build_object('ok', true, 'version', 1, 'updated_at', stamp);
  END IF;
  IF cur.version <> COALESCE(p_base, 0) THEN RETURN jsonb_build_object('ok', false, 'version', cur.version); END IF;
  UPDATE ts_drafts d SET html = p_html, version = cur.version + 1, updated_at = stamp, updated_by = p_actor WHERE d.topic_id = p_topic;
  RETURN jsonb_build_object('ok', true, 'version', cur.version + 1, 'updated_at', stamp);
END $$;

-- Adds a snapshot and keeps the newest 40 (automatic ones are dropped first).
CREATE OR REPLACE FUNCTION public.ts_add_version(p_topic UUID, p_kind TEXT, p_html TEXT, p_note TEXT, p_words INTEGER, p_actor UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id BIGINT;
  extra INTEGER;
BEGIN
  INSERT INTO ts_draft_versions (topic_id, saved_by, kind, note, html, words)
  VALUES (p_topic, p_actor, p_kind, COALESCE(p_note, ''), p_html, COALESCE(p_words, 0))
  RETURNING id INTO new_id;
  SELECT count(*) - 40 INTO extra FROM ts_draft_versions v WHERE v.topic_id = p_topic;
  IF extra > 0 THEN
    DELETE FROM ts_draft_versions WHERE id IN (
      SELECT v.id FROM ts_draft_versions v WHERE v.topic_id = p_topic
      ORDER BY (v.kind <> 'auto'), v.saved_at, v.id LIMIT extra
    );
  END IF;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION ts_save_draft(UUID, TEXT, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ts_add_version(UUID, TEXT, TEXT, TEXT, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

COMMIT;

-- db_protections_check also watches the three new tables and two functions (as in 156).
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
                        'invoice_sends','reimbursement_changes',
                        'ts_clients','ts_topics','ts_pages','ts_topic_history','ts_drafts','ts_draft_versions','ts_feedback']) t,
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
                        'agenda_booking_confirm(text,integer)','ts_import_topic(jsonb,uuid)','ts_patch_topic(uuid,jsonb,jsonb,uuid)','ts_save_page(uuid,jsonb,uuid)','ts_save_draft(uuid,text,integer,uuid)','ts_add_version(uuid,text,text,text,integer,uuid)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

NOTIFY pgrst, 'reload schema';
