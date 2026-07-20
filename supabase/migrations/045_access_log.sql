-- 045_access_log.sql
-- Records when and who accessed the portal (one row per visit/session). Each
-- signed-in user may insert their own rows; only admins can read the log.

create table if not exists access_log (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  person_id   uuid references people(id) on delete set null,
  email       text,
  name        text,
  user_agent  text,
  accessed_at timestamptz not null default now()
);

create index if not exists access_log_accessed_at_idx on access_log (accessed_at desc);
create index if not exists access_log_profile_idx on access_log (profile_id, accessed_at desc);

alter table access_log enable row level security;

-- A signed-in user can record their own access.
drop policy if exists access_log_insert_own on access_log;
create policy access_log_insert_own on access_log for insert to authenticated
  with check (profile_id = auth.uid());

-- Only admins can read the log.
drop policy if exists access_log_admin_read on access_log;
create policy access_log_admin_read on access_log for select to authenticated
  using (is_admin(auth.uid()));
