-- 155_topic_studio.sql
--
-- Topic Studio in the portal, phase 0 (owner, 5 November 2026; plan:
-- Design/Topic Studio plan, mockup approved the same day). The SEO brief tool
-- that ran as a Claude Artifact moves here; its topics arrive by importing the
-- .topic-studio.json files the Artifact exports, as often as needed.
--
--   ts_clients        the clients a topic is written for (code, name and the
--                     profile the Artifact keeps: heading, faith, about, what
--                     counts as original). Filled by the import for now.
--   ts_topics         one topic brief. The Artifact's project id is kept
--                     (artifact_id) so a second import of the same topic
--                     updates it and never duplicates it. `data` holds the
--                     whole project as the Artifact exported it (terms, groups,
--                     questions, AI answers, draft, rules), so nothing is lost
--                     before each tab is built on it. `shared` is "shared with
--                     writers": only shared topics reach the Writers team.
--   ts_pages          the competitor pages captured for a topic, as exported.
--   ts_topic_history  a topic as it was before an import replaced it (and,
--                     from phase 2, the saved versions of the draft).
--
-- Access: two tools in the catalogue (src/lib/access/catalogue.ts), each with
-- its team list, seeded here by team name and logged on Admin > Access levels:
--   topic-studio      the Writer workshop and SEO brief of shared topics:
--                     the SEO and Writers teams, whole team.
--   topic-studio-seo  every topic and tab, import, share: the SEO team.
--
-- Server only, as 116 and 122: RLS on, nothing for the anonymous or signed-in
-- role; the portal reads and writes with the service key after asking the
-- access rule. Watched by the daily check. Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS ts_clients (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  -- heading, faith, about, orig: the client profile the Artifact keeps.
  profile     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ts_clients IS 'Topic Studio: the clients topics are written for, with the profile the prompts use.';

CREATE TABLE IF NOT EXISTS ts_topics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id         TEXT UNIQUE,
  client_code         TEXT NOT NULL REFERENCES ts_clients(code) ON UPDATE CASCADE,
  topic               TEXT NOT NULL,
  primary_keyphrase   TEXT NOT NULL DEFAULT '',
  monday_url          TEXT,
  shared              BOOLEAN NOT NULL DEFAULT false,
  archived            BOOLEAN NOT NULL DEFAULT false,
  data                JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The project's own "updated" time in the Artifact, and a hash of the file's
  -- content, to tell New, Updated, Same and Older apart on the next import.
  artifact_updated_at TIMESTAMPTZ,
  content_hash        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES people(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES people(id) ON DELETE SET NULL,
  imported_at         TIMESTAMPTZ,
  imported_by         UUID REFERENCES people(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS ts_topics_list_idx ON ts_topics (archived, updated_at DESC);
COMMENT ON TABLE ts_topics IS 'Topic Studio: one SEO topic brief. data = the Artifact project as exported.';
COMMENT ON COLUMN ts_topics.artifact_id IS 'The project id in the Topic Studio Artifact; an import matches on it.';
COMMENT ON COLUMN ts_topics.shared IS 'Shared with writers: only shared, unarchived topics reach the Writers team.';

CREATE TABLE IF NOT EXISTS ts_pages (
  id           BIGSERIAL PRIMARY KEY,
  topic_id     UUID NOT NULL REFERENCES ts_topics(id) ON DELETE CASCADE,
  artifact_id  TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  kind         TEXT NOT NULL DEFAULT 'competitor',
  url          TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  -- blocks, links, desc, method, captured: the page as the Artifact captured it.
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ts_pages_topic_idx ON ts_pages (topic_id, position);
COMMENT ON TABLE ts_pages IS 'Topic Studio: the competitor pages captured for a topic.';

CREATE TABLE IF NOT EXISTS ts_topic_history (
  id         BIGSERIAL PRIMARY KEY,
  topic_id   UUID NOT NULL REFERENCES ts_topics(id) ON DELETE CASCADE,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by   UUID REFERENCES people(id) ON DELETE SET NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('import')),
  -- The topic row and its pages as they were.
  topic      JSONB NOT NULL,
  pages      JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS ts_topic_history_topic_idx ON ts_topic_history (topic_id, saved_at DESC);
COMMENT ON TABLE ts_topic_history IS 'Topic Studio: a topic as it was before an import replaced it.';

ALTER TABLE ts_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_topic_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ts_clients, ts_topics, ts_pages, ts_topic_history FROM anon, authenticated;
REVOKE ALL ON SEQUENCE ts_pages_id_seq, ts_topic_history_id_seq FROM anon, authenticated;

-- The two tools' team lists, once: a later run never undoes what a Super Admin
-- changed on Admin > Access levels.
DO $$
DECLARE
  seo UUID := (SELECT id FROM teams WHERE name = 'SEO');
  writers UUID := (SELECT id FROM teams WHERE name = 'Writers');
BEGIN
  IF EXISTS (SELECT 1 FROM access_tool_teams WHERE item_key IN ('topic-studio', 'topic-studio-seo')) THEN
    RETURN;
  END IF;
  IF seo IS NULL OR writers IS NULL THEN
    RAISE EXCEPTION 'Teams SEO and Writers must exist';
  END IF;
  INSERT INTO access_tool_teams (item_key, team_id, audience) VALUES
    ('topic-studio', seo, 'team'),
    ('topic-studio', writers, 'team'),
    ('topic-studio-seo', seo, 'team');
  INSERT INTO access_changes (actor_id, kind, summary, reason, changes)
  VALUES (
    (SELECT id FROM people WHERE full_name = 'Arnaldo Oliveira' LIMIT 1),
    'tool-teams',
    'Teams for Topic Studio',
    'Topic Studio moves into the portal (owner, 5 November 2026): the SEO and Writers teams, employees and contractors alike. SEOs research every topic; writers open the topics shared with them.',
    jsonb_build_array(
      jsonb_build_object('kind', 'tool', 'key', 'topic-studio', 'label', 'Topic Studio',
        'before', jsonb_build_object('every', false, 'teams', '{}'::jsonb),
        'after', jsonb_build_object('every', false, 'teams', jsonb_build_object(seo::text, 'team', writers::text, 'team'))),
      jsonb_build_object('kind', 'tool', 'key', 'topic-studio-seo', 'label', 'Topic Studio · SEO research',
        'before', jsonb_build_object('every', false, 'teams', '{}'::jsonb),
        'after', jsonb_build_object('every', false, 'teams', jsonb_build_object(seo::text, 'team')))
    )
  );
END $$;

-- One topic from an import, all or nothing: its client, the topic (the old
-- one kept in ts_topic_history first when it was already here) and its pages.
-- payload: artifact_id, client {code, name, profile}, topic, primary_keyphrase,
-- monday_url, shared, archived, data, artifact_updated_at, content_hash and
-- pages [{artifact_id, kind, url, title, data, captured_at}], already checked
-- by the server (src/lib/topic-studio/import-file.ts). Returns the topic's id.
CREATE OR REPLACE FUNCTION public.ts_import_topic(payload JSONB, actor UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_id UUID;
  old ts_topics;
BEGIN
  INSERT INTO ts_clients (code, name, profile, updated_at)
  VALUES (payload->'client'->>'code', payload->'client'->>'name', COALESCE(payload->'client'->'profile', '{}'::jsonb), now())
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, profile = EXCLUDED.profile, updated_at = now();

  SELECT * INTO old FROM ts_topics WHERE artifact_id = payload->>'artifact_id' FOR UPDATE;
  IF FOUND THEN
    INSERT INTO ts_topic_history (topic_id, saved_by, reason, topic, pages)
    VALUES (old.id, actor, 'import', to_jsonb(old),
      COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.position) FROM ts_pages p WHERE p.topic_id = old.id), '[]'::jsonb));
    UPDATE ts_topics SET
      client_code = payload->'client'->>'code',
      topic = payload->>'topic',
      primary_keyphrase = COALESCE(payload->>'primary_keyphrase', ''),
      monday_url = NULLIF(payload->>'monday_url', ''),
      shared = COALESCE((payload->>'shared')::boolean, false),
      archived = COALESCE((payload->>'archived')::boolean, false),
      data = COALESCE(payload->'data', '{}'::jsonb),
      artifact_updated_at = NULLIF(payload->>'artifact_updated_at', '')::timestamptz,
      content_hash = payload->>'content_hash',
      updated_at = now(), updated_by = actor, imported_at = now(), imported_by = actor
    WHERE id = old.id;
    DELETE FROM ts_pages WHERE topic_id = old.id;
    t_id := old.id;
  ELSE
    INSERT INTO ts_topics (artifact_id, client_code, topic, primary_keyphrase, monday_url, shared, archived, data,
                           artifact_updated_at, content_hash, created_by, updated_by, imported_at, imported_by)
    VALUES (payload->>'artifact_id', payload->'client'->>'code', payload->>'topic', COALESCE(payload->>'primary_keyphrase', ''),
            NULLIF(payload->>'monday_url', ''), COALESCE((payload->>'shared')::boolean, false), COALESCE((payload->>'archived')::boolean, false),
            COALESCE(payload->'data', '{}'::jsonb), NULLIF(payload->>'artifact_updated_at', '')::timestamptz, payload->>'content_hash',
            actor, actor, now(), actor)
    RETURNING id INTO t_id;
  END IF;

  INSERT INTO ts_pages (topic_id, artifact_id, position, kind, url, title, data, captured_at)
  SELECT t_id, pg->>'artifact_id', (ord - 1)::int, COALESCE(pg->>'kind', 'competitor'), COALESCE(pg->>'url', ''),
         COALESCE(pg->>'title', ''), COALESCE(pg->'data', '{}'::jsonb), NULLIF(pg->>'captured_at', '')::timestamptz
    FROM jsonb_array_elements(COALESCE(payload->'pages', '[]'::jsonb)) WITH ORDINALITY AS x(pg, ord);

  RETURN t_id;
END $$;

REVOKE ALL ON FUNCTION ts_import_topic(JSONB, UUID) FROM PUBLIC, anon, authenticated;

COMMIT;

-- db_protections_check watches the new tables and function too (as in migration 153,
-- plus the four ts_ tables and ts_import_topic).
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
                        'agenda_booking_confirm(text,integer)','ts_import_topic(jsonb,uuid)']) f,
           unnest(ARRAY['anon','authenticated']) r
     WHERE has_function_privilege(r, f, 'EXECUTE')
  ) open
$$;

NOTIFY pgrst, 'reload schema';
