-- 042_person_address.sql
-- Structured mailing address, stored as JSON so it works for any country:
--   { country, zip, line1, line2, city, state }
-- (country is an ISO 3166-1 alpha-2 code). Separate from the short "location"
-- (city / country) already stored. No real address data exists yet, so a
-- straight drop + add is safe and this stays re-runnable.

alter table people drop column if exists address;
alter table people add column address jsonb;
