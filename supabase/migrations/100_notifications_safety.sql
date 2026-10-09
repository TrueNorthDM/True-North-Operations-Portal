-- 100_notifications_safety.sql
--
-- Two changes from the audit of 9 October 2026, module 5 (notifications):
--
-- 1. A daily summary is claimed before it is sent. The run wrote down "sent"
--    only after the email went, so two runs overlapping (a slow send) or a
--    restart between sending and writing could send the same summary twice.
--    Now the run first writes the digest row as 'sending' (a new row, or a
--    'failed' one taken over with a check that nobody else took it), and only
--    the run that wrote it sends.
--
-- 2. The read rules that let an admin session read everyone's notifications,
--    choices and settings go. The portal never used them (every read is the
--    server's, with the service role), and through them an Admin could read
--    notifications meant only for Super Admins. Row-level security stays on,
--    so the signed-in role reads nothing.

BEGIN;

ALTER TABLE notification_digests DROP CONSTRAINT IF EXISTS notification_digests_status_check;
ALTER TABLE notification_digests
  ADD CONSTRAINT notification_digests_status_check CHECK (status IN ('sending','sent','skipped','failed'));

DROP POLICY IF EXISTS notifications_admin_read ON notifications;
DROP POLICY IF EXISTS notification_rules_admin_read ON notification_rules;
DROP POLICY IF EXISTS notification_prefs_admin_read ON notification_prefs;
DROP POLICY IF EXISTS notification_state_admin_read ON notification_state;
DROP POLICY IF EXISTS notification_digests_admin_read ON notification_digests;
DROP POLICY IF EXISTS person_settings_admin_read ON person_settings;

COMMIT;

NOTIFY pgrst, 'reload schema';
