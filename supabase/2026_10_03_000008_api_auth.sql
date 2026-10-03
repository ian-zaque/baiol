-- Accounts live in public.profiles. Safe to run more than once.
-- Passwords stored by Supabase Auth cannot be copied. Existing profile rows
-- receive an unusable hash and cannot sign in.

do $$
declare
  constraint_name text;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'auth'
      and table_name = 'users'
  ) then
    drop trigger if exists on_auth_user_created on auth.users;
  end if;

  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'profiles'
    and con.contype = 'f'
    and pg_get_constraintdef(con.oid) ilike '%auth.users%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

drop function if exists public.handle_new_user();

alter table public.profiles
  add column if not exists password_hash text;

update public.profiles
set password_hash = ''
where password_hash is null;

alter table public.profiles
  alter column password_hash set not null;

drop function if exists public.apply_profile_insert(uuid, text, uuid, text, text);

create or replace function public.apply_profile_insert(
  p_actor_id uuid,
  p_action text,
  p_id uuid,
  p_email text,
  p_display_name text,
  p_password_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.profiles;
begin
  insert into public.profiles (id, email, display_name, password_hash)
  values (p_id, p_email, p_display_name, p_password_hash)
  returning * into rec;

  insert into public.profiles_log (
    profile_id, updated_by_id, action, email, display_name, created_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.email, rec.display_name, rec.created_at, rec.deleted_at
  );

  return to_jsonb(rec) - 'password_hash';
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

  return to_jsonb(rec) - 'password_hash';
end;
$$;

revoke all on function public.apply_profile_insert(uuid, text, uuid, text, text, text) from public;
revoke all on function public.apply_profile_update(uuid, text, uuid, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_profile_insert(uuid, text, uuid, text, text, text) to service_role;
    grant execute on function public.apply_profile_update(uuid, text, uuid, jsonb) to service_role;
  end if;
end $$;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists sessions_token_hash_active_idx
  on public.sessions (token_hash)
  where revoked_at is null;

alter table public.sessions enable row level security;
