-- 043_onboarding_offboarding_status.sql
-- Replaces the three imported onboarding flags (company_email, uses_system,
-- team_meeting) with two lifecycle status fields:
--   onboarding_status  — 'not_started' | 'in_progress' | 'completed'
--   offboarding_status — 'not_started' | 'in_progress' | 'completed'
-- Backfill: everyone counts as onboarded; only inactive people are offboarded.
-- Safe to run more than once.

alter table people add column if not exists onboarding_status text;
alter table people add column if not exists offboarding_status text;

update people set onboarding_status = 'completed' where onboarding_status is null;
update people set offboarding_status = case when status = 'inactive' then 'completed' else 'not_started' end where offboarding_status is null;

-- Retire the old onboarding flags.
alter table people drop column if exists company_email;
alter table people drop column if exists uses_system;
alter table people drop column if exists team_meeting;
