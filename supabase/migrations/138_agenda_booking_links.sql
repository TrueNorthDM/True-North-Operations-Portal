-- Agenda and Google Calendar, part 3 (owner, 30 October 2026): everyone's
-- personal booking link and the public page where anyone, inside or outside
-- True North, books a meeting with them.
--
-- The booker picks a free time and gives a name and an email; the time is
-- held for 15 minutes while they confirm from the email, and only then is the
-- meeting made, on the host's chosen Google account, with the booker and up
-- to 10 guests invited. Holding and confirming go through the two functions
-- below, one host at a time, so two people can never book the same time.
-- Server only, like the rest of the Agenda.

BEGIN;

-- ── Each person's booking link ──────────────────────────────────────────────
-- Off until the person turns it on. account_id: "Create the meetings on".
CREATE TABLE IF NOT EXISTS agenda_booking_links (
  person_id    UUID PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 60),
  is_on        BOOLEAN NOT NULL DEFAULT false,
  lengths      INTEGER[] NOT NULL DEFAULT '{30,60}' CHECK (cardinality(lengths) BETWEEN 1 AND 4 AND lengths <@ '{15,30,45,60}'::integer[]),
  gap_min      INTEGER NOT NULL DEFAULT 10 CHECK (gap_min IN (0, 10, 15)),
  notice_min   INTEGER NOT NULL DEFAULT 1440 CHECK (notice_min IN (120, 1440, 2880)),
  window_days  INTEGER NOT NULL DEFAULT 30 CHECK (window_days IN (14, 30, 60)),
  account_id   BIGINT REFERENCES agenda_accounts(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Bookings ────────────────────────────────────────────────────────────────
-- held: waiting for the email confirmation until held_until; booked: the
-- meeting is made (event_id); expired: not confirmed in time.
-- token_hash: the SHA-256 of the link in the email, never the link itself.
-- client_key: a hash of the booker's network address, for the rate limits.
-- emails_sent: the confirmation email at most 3 times ("send it again").
CREATE TABLE IF NOT EXISTS agenda_bookings (
  id            BIGSERIAL PRIMARY KEY,
  host_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email         TEXT NOT NULL CHECK (length(email) <= 254),
  guests        TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(guests) <= 10),
  note          TEXT CHECK (length(note) <= 2000),
  booker_zone   TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'booked', 'expired')),
  token_hash    TEXT NOT NULL UNIQUE,
  held_until    TIMESTAMPTZ NOT NULL,
  confirmed_at  TIMESTAMPTZ,
  emails_sent   INTEGER NOT NULL DEFAULT 0,
  emailed_at    TIMESTAMPTZ,
  event_id      BIGINT REFERENCES agenda_events(id) ON DELETE SET NULL,
  client_key    TEXT,
  source        TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'sample')),
  sample_key    TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS agenda_bookings_host_idx ON agenda_bookings (host_id, starts_at);
CREATE INDEX IF NOT EXISTS agenda_bookings_client_idx ON agenda_bookings (client_key, created_at);
CREATE INDEX IF NOT EXISTS agenda_bookings_email_idx ON agenda_bookings (lower(email), created_at);

ALTER TABLE agenda_booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON agenda_booking_links, agenda_bookings FROM anon, authenticated;
REVOKE ALL ON SEQUENCE agenda_bookings_id_seq FROM anon, authenticated;

-- ── Holding a time ──────────────────────────────────────────────────────────
-- One host at a time (an advisory lock): refuses a time that overlaps, with
-- the gap on both sides, another live hold or a booking. Returns the new id,
-- or null when the time was just taken.
CREATE OR REPLACE FUNCTION public.agenda_booking_hold(
  p_host UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ, p_gap INTEGER,
  p_name TEXT, p_email TEXT, p_guests TEXT[], p_note TEXT, p_zone TEXT,
  p_token_hash TEXT, p_client TEXT, p_held_until TIMESTAMPTZ)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_pad INTERVAL := make_interval(mins => GREATEST(p_gap, 0));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda_booking:' || p_host::text, 0));
  IF EXISTS (
    SELECT 1 FROM agenda_bookings b
     WHERE b.host_id = p_host
       AND (b.state = 'booked' OR (b.state = 'held' AND b.held_until > now()))
       AND b.starts_at < p_end + v_pad AND b.ends_at > p_start - v_pad
  ) THEN
    RETURN NULL;
  END IF;
  INSERT INTO agenda_bookings (host_id, starts_at, ends_at, name, email, guests, note, booker_zone, token_hash, held_until, client_key)
  VALUES (p_host, p_start, p_end, p_name, p_email, COALESCE(p_guests, '{}'), p_note, p_zone, p_token_hash, p_held_until, p_client)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

-- ── Confirming ──────────────────────────────────────────────────────────────
-- Turns a live hold into a booking, under the same lock, unless another
-- booking took the time meanwhile. Returns the booking id; null when the hold
-- is unknown, already used or expired, or the time is no longer free.
CREATE OR REPLACE FUNCTION public.agenda_booking_confirm(p_token_hash TEXT, p_gap INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b agenda_bookings%ROWTYPE;
  v_pad INTERVAL := make_interval(mins => GREATEST(p_gap, 0));
BEGIN
  SELECT * INTO b FROM agenda_bookings WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda_booking:' || b.host_id::text, 0));
  SELECT * INTO b FROM agenda_bookings WHERE id = b.id FOR UPDATE;
  IF b.state <> 'held' OR b.held_until <= now() THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT 1 FROM agenda_bookings o
     WHERE o.host_id = b.host_id AND o.id <> b.id AND o.state = 'booked'
       AND o.starts_at < b.ends_at + v_pad AND o.ends_at > b.starts_at - v_pad
  ) THEN
    RETURN NULL;
  END IF;
  UPDATE agenda_bookings SET state = 'booked', confirmed_at = now() WHERE id = b.id;
  RETURN b.id;
END
$$;

REVOKE ALL ON FUNCTION public.agenda_booking_hold(uuid,timestamptz,timestamptz,integer,text,text,text[],text,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_booking_confirm(text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_booking_hold(uuid,timestamptz,timestamptz,integer,text,text,text[],text,text,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.agenda_booking_confirm(text,integer) TO service_role;

-- ── The daily check watches them too ───────────────────────────────────────
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
                        'agenda_booking_links','agenda_bookings',
                        'reimbursement_reports']) t,
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

COMMIT;
