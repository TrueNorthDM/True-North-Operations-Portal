-- 046_system_health.sql
-- Periodic health checks of the portal's external integrations (Monday, TSheets)
-- so a silent outage (like a dead webhook) surfaces instead of going unnoticed
-- for weeks. One row per (service, run). Written only by the service-role client
-- (the health cron and the admin "Run checks now" action); read by admins via
-- the service-role client on the Automations page. RLS denies the authenticated
-- role entirely, same posture as monday_events.

create table if not exists public.system_health_checks (
  id         uuid primary key default gen_random_uuid(),
  service    text not null,                 -- 'monday_api' | 'monday_webhook' | 'monday_events' | 'tsheets_api'
  ok         boolean not null,
  status     text not null default 'ok',    -- 'ok' | 'warn' | 'down'
  detail     text,
  checked_at timestamptz not null default now()
);

create index if not exists system_health_checks_service_time_idx
  on public.system_health_checks (service, checked_at desc);

alter table public.system_health_checks enable row level security;
-- No policies on purpose: anon/authenticated get nothing; the service-role key
-- bypasses RLS, so the cron and admin page (which use createAdminClient) can
-- read and write.
