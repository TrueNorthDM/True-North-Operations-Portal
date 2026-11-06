-- 156_topic_studio_phase1.sql
--
-- Topic Studio, phase 1 (owner, 5 November 2026): topics are made and worked on
-- in the portal now, so the database gets the two writes the screens need and
-- the two clients that no import had brought yet. Safe to run again.
--
--   ts_clients          HFA (Hope for Africa) and WM (Wagner Meters), with the
--                       profile the Artifact keeps for them; AAAF and BM arrived
--                       with the first import and are left as they are.
--   ts_patch_topic      changes a topic without reading it first: the keys of
--                       `patch` replace those keys of ts_topics.data (a null
--                       removes the key), `cols` may set the topic's own columns
--                       (topic, primary_keyphrase, monday_url, client_code,
--                       shared, archived). One statement, so two people working
--                       on different parts of a topic never overwrite each other.
--   ts_save_page        stores one captured page: the page with the same Artifact
--                       id is replaced, a new one goes last. Returns its id.
--
-- As 155: server only, nothing callable by the anonymous or signed-in role,
-- watched by the daily check.

BEGIN;

INSERT INTO ts_clients (code, name, profile) VALUES
  ('HFA', 'Hope for Africa', '{"orig": "Original material drawn from real life in Africa, such as a story or testimony, a life event, a prayer request shared with permission and personal details removed, a quote or advice from a pastor, Bible worker or ministry staff member, an insight from a Bible study or message, a real question or comment from a reader or social media, a clear recommendation or point of view, or regional context such as local practices, language and everyday realities. Writers can draw on their own experience or ask colleagues, church members, friends or their social groups. It should carry a Seventh-day Adventist biblical perspective and show how Scripture applies to everyday life in African communities. Get permission before quoting or naming anyone.", "about": "Hope for Africa is a Seventh-day Adventist ministry website that helps people across Africa find biblical, practical answers to life’s questions and challenges using Christ’s method. Its readers come from many countries, cultures and faith backgrounds, and many are looking for guidance on faith, family, relationships, health, finances and the future. Write warmly and compassionately, in plain speech that’s easy to follow, with examples that reflect African cultural and language realities. Content is Christ-centered and grounded in Scripture, and it invites rather than pressures readers about what to believe.", "faith": true, "heading": "HFA Topic"}'::jsonb),
  ('WM', 'Wagner Meters', '{"orig": "Original material from Wagner Meters’ own knowledge or customers, such as test results or measurement data; a field-tested technique or troubleshooting tip from an engineer, product specialist or trainer; a real customer case study or use case; lessons from support tickets, warranty claims, sales calls or distributor feedback; a clear recommendation or position, such as when a method shouldn’t be used; or original photos or video. Writers can ask Wagner’s engineers, product specialists, support and sales teams for examples. Get permission before quoting or naming customers, and cite the source of any data.", "about": "Wagner Meters is the leading manufacturer of professional moisture measurement tools for wood, concrete, flooring and industrial uses, backed by decades of experience in moisture measurement. Its readers are professionals who rely on accurate readings: woodworkers, flooring installers, building contractors, inspectors, concrete professionals, sawmills and wood product manufacturers. Write in a technically accurate, practical and authoritative way that stays approachable, helping readers prevent moisture-related failures, work efficiently, protect their reputations and make informed decisions about testing and managing moisture.", "faith": false, "heading": "WM Topic"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ts_patch_topic(p_topic UUID, p_patch JSONB, p_cols JSONB, p_actor UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gone TEXT[];
  stamp TIMESTAMPTZ;
BEGIN
  SELECT COALESCE(array_agg(key), '{}') INTO gone FROM jsonb_each(COALESCE(p_patch, '{}'::jsonb)) WHERE value = 'null'::jsonb;
  UPDATE ts_topics t SET
    data = (t.data - gone) || jsonb_strip_nulls(COALESCE(p_patch, '{}'::jsonb)),
    topic = COALESCE(p_cols->>'topic', t.topic),
    primary_keyphrase = COALESCE(p_cols->>'primary_keyphrase', t.primary_keyphrase),
    monday_url = CASE WHEN p_cols ? 'monday_url' THEN NULLIF(p_cols->>'monday_url', '') ELSE t.monday_url END,
    client_code = COALESCE(p_cols->>'client_code', t.client_code),
    shared = COALESCE((p_cols->>'shared')::boolean, t.shared),
    archived = COALESCE((p_cols->>'archived')::boolean, t.archived),
    updated_at = now(), updated_by = p_actor
  WHERE t.id = p_topic
  RETURNING t.updated_at INTO stamp;
  IF stamp IS NULL THEN RAISE EXCEPTION 'topic_not_found'; END IF;
  RETURN stamp;
END $$;

CREATE OR REPLACE FUNCTION public.ts_save_page(p_topic UUID, p_page JSONB, p_actor UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id BIGINT;
  slot INTEGER;
BEGIN
  PERFORM 1 FROM ts_topics t WHERE t.id = p_topic FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'topic_not_found'; END IF;
  SELECT g.position INTO slot FROM ts_pages g WHERE g.topic_id = p_topic AND g.artifact_id = p_page->>'artifact_id' LIMIT 1;
  DELETE FROM ts_pages g WHERE g.topic_id = p_topic AND g.artifact_id = p_page->>'artifact_id';
  IF slot IS NULL THEN SELECT COALESCE(max(g.position) + 1, 0) INTO slot FROM ts_pages g WHERE g.topic_id = p_topic; END IF;
  INSERT INTO ts_pages (topic_id, artifact_id, position, kind, url, title, data, captured_at)
  VALUES (p_topic, p_page->>'artifact_id', slot, COALESCE(p_page->>'kind', 'competitor'), COALESCE(p_page->>'url', ''),
          COALESCE(p_page->>'title', ''), COALESCE(p_page->'data', '{}'::jsonb), COALESCE(NULLIF(p_page->>'captured_at', '')::timestamptz, now()))
  RETURNING id INTO new_id;
  UPDATE ts_topics t SET updated_at = now(), updated_by = p_actor WHERE t.id = p_topic;
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION ts_patch_topic(UUID, JSONB, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ts_save_page(UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;

COMMIT;

-- db_protections_check also watches the two new functions (as in 155).
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
                        'ts_clients','ts_topics','ts_pages','ts_topic_history']) t,
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
                        'agenda_booking_confirm(text,integer)','ts_import_topic(jsonb,uuid)','ts_patch_topic(uuid,jsonb,jsonb,uuid)','ts_save_page(uuid,jsonb,uuid)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

NOTIFY pgrst, 'reload schema';
