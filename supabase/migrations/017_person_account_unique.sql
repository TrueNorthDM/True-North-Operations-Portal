-- 017_person_account_unique.sql
--
-- A portal account (profiles row) links to at most one person in the directory.
-- Lets the People editor attach an account to a person so access grants resolve
-- to a real login. Partial unique index allows many people with no account
-- (profile_id NULL) but blocks linking one account to two people.

CREATE UNIQUE INDEX IF NOT EXISTS people_profile_id_unique
  ON people (profile_id)
  WHERE profile_id IS NOT NULL;
