-- 056_contact_columns_off_limits.sql
--
-- Finishes what 054 started. That migration took pay out of reach of the
-- signed-in role and the callout on Admin -> Access levels was updated to say
-- exactly that, while admitting four columns were still open:
--
--   GET /rest/v1/people?select=full_name,address,date_of_birth,email_personal,phone
--
-- with the public anon key from the JS bundle and the reader's own session
-- token. Home address, birth date, personal mailbox and personal number, for
-- everyone in the company, to anyone with a login.
--
-- WHY THESE FOUR AND NOT `location`. These are the columns a colleague would be
-- upset to find someone had pulled. `location` is a city, it labels people all
-- over the product, and locking it would cost a lot for very little.
--
-- The code half landed first and had to. Eight read sites now go through
-- lib/hr/contact.ts on the service-role client, each keeping the rule it
-- already had. One is worth knowing about: loadCurrentPerson resolves the
-- signed-in user by matching their login against every mailbox on the row,
-- personal included, so it moved to the service-role client too. That is also
-- the more correct arrangement: "who am I" is the answer every other permission
-- check is built on, and should not itself be an RLS question.
--
-- Dates of birth are still read for EVERY person on the Home page, by everyone,
-- to build the birthdays board. That is fine and stays: those widgets are
-- server components that render "Apr 7" and nothing else, so the year never
-- reaches a browser. Checked in the page HTML, not assumed.
--
-- ⚠ SAME FOOTGUN AS 054, now covering six columns. The grant lists columns
-- explicitly, so a column added to `people` later is NOT readable by
-- `authenticated` until it is granted, and PostgREST drops the whole query on a
-- permission error, so the symptom is a blank screen rather than a missing
-- field. After adding a column, re-run this migration: it recomputes the list.
--
-- Verify afterwards, signed in as a NON-admin, with that session's token:
--   curl "$URL/rest/v1/people?select=phone" -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT"
-- Expect 403 "permission denied for column", not a list of numbers.

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'people'
     AND column_name NOT IN (
       -- pay, from 054
       'internal_rate', 'monthly_salary',
       -- contact, from this migration
       'address', 'date_of_birth', 'email_personal', 'phone'
     );

  EXECUTE 'REVOKE SELECT ON public.people FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.people TO authenticated', cols);
END $$;
