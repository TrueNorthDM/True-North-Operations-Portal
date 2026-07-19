-- 044_person_milestones.sql
-- Employment milestones: a manual career timeline per person, stored as a JSON
-- array of { kind, date, note } (kind = joined | promotion | role_change |
-- role_addition | left | other). Safe to run more than once.

alter table people add column if not exists milestones jsonb;
