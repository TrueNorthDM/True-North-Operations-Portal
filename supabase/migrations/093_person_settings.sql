-- 093_person_settings.sql
--
-- The personal Settings page, decided on 7 October 2026: everything a person
-- chooses for themselves, beside the time zone migration 092 started.
--
--   summary_hour      the hour the daily summary lands, in their time zone.
--                     Null: 8:00.
--   start_page        where they land after signing in: 'home' or 'my-work'.
--                     Null: Home.
--   favourites        up to five pages (navigation keys, in order) shown at
--                     the top of Home.
--   show_birthday     whether Home shows their birthday (day and month only).
--   show_anniversary  whether Home shows their work anniversary.
--
-- Same access as 092: the server reads and writes with the service role for
-- the person it identified; the signed-in role may only read, and only admins.

BEGIN;

ALTER TABLE person_settings
  ADD COLUMN IF NOT EXISTS summary_hour     SMALLINT CHECK (summary_hour BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS start_page       TEXT CHECK (start_page IN ('home','my-work')),
  ADD COLUMN IF NOT EXISTS favourites       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS show_birthday    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_anniversary BOOLEAN NOT NULL DEFAULT true;

COMMIT;
