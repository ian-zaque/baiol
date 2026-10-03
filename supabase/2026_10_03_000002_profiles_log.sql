-- Soft-delete and append-only log for profiles.
-- Safe to run more than once.

alter table public.profiles
  add column if not exists deleted_at timestamptz;

drop index if exists public.profiles_email_idx;
create unique index if not exists profiles_email_active_idx
  on public.profiles (lower(email))
  where deleted_at is null;

create table if not exists public.profiles_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  updated_by_id uuid references public.profiles (id) on delete set null,
  action text not null,
  email text not null,
  display_name text,
  created_at timestamptz,
  deleted_at timestamptz
);

create or replace function public.reject_log_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop trigger if exists profiles_log_append_only on public.profiles_log;
create trigger profiles_log_append_only
before update or delete on public.profiles_log
for each row execute function public.reject_log_change();

alter table public.profiles_log enable row level security;

create or replace function public.apply_profile_insert(
  p_actor_id uuid,
  p_action text,
  p_id uuid,
  p_email text,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.profiles;
begin
  insert into public.profiles (id, email, display_name)
  values (p_id, p_email, p_display_name)
  returning * into rec;

  insert into public.profiles_log (
    profile_id, updated_by_id, action, email, display_name, created_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.email, rec.display_name, rec.created_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

create or replace function public.apply_profile_update(
  p_actor_id uuid,
  p_action text,
  p_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.profiles;
begin
  update public.profiles
  set
    email = case when p_patch ? 'email' then p_patch->>'email' else email end,
    display_name = case when p_patch ? 'display_name' then p_patch->>'display_name' else display_name end
  where id = p_id
  returning * into rec;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.profiles_log (
    profile_id, updated_by_id, action, email, display_name, created_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.email, rec.display_name, rec.created_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

revoke all on function public.apply_profile_insert(uuid, text, uuid, text, text) from public;
revoke all on function public.apply_profile_update(uuid, text, uuid, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_profile_insert(uuid, text, uuid, text, text) to service_role;
    grant execute on function public.apply_profile_update(uuid, text, uuid, jsonb) to service_role;
  end if;
end $$;
