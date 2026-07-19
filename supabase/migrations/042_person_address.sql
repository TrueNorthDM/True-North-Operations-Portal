-- 042_person_address.sql
-- Full mailing address for a person, separate from the short "location"
-- (city / country) already stored. Free text so it can hold a multi-line
-- street address. Safe to run more than once.

alter table people add column if not exists address text;
