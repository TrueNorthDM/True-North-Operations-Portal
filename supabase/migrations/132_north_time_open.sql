-- North Time open (owner, 29 October 2026): North Time's code and tables go to
-- production now, but nobody uses it there until the owner opens it. One
-- switch, changed only by a Super Admin in Company settings > North Time
-- rollout. While it is off nobody records hours in North Time (clock, Add time,
-- week grid, requests, approvals), its scheduled jobs do nothing, and the
-- TSheets import keeps taking every entry. Off by default: a database that
-- never set it is closed. Staging turns it on by hand to keep testing.

alter table public.app_settings
  add column if not exists north_time_open boolean not null default false;

comment on column public.app_settings.north_time_open is
  'North Time in use. Off: nobody records hours in North Time and its scheduled jobs do nothing. Super Admin only, Company settings > North Time rollout.';
