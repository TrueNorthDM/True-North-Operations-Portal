-- 066_monday_external_users.sql
--
-- "Not one of ours" is an answer, and the pending list needs it.
--
-- Discovery found 46 Monday accounts. 28 are people in the directory, matched
-- by email. Of the 18 left, about half are True North people who signed into
-- Monday with a personal address, and the rest are the client's own staff:
-- i7marketing.com, southern.edu. Those will never be in the directory, and
-- they should not be, but with only "link to a person" available they would be
-- reported as unresolved on every single run.
--
-- A pending list that never empties stops being read, and then the real
-- pending item hides among the permanent ones.

ALTER TABLE monday_users
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN monday_users.is_external IS
  'Marked by a person: this account belongs to a client or outside collaborator, '
  'so it is deliberately linked to nobody and stops being reported as pending. '
  'Their assignments still exist; they just never fall under one of our teams.';
