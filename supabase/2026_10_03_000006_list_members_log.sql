-- Soft-delete and append-only log for list members.
-- Creating a list also writes the owner membership and both log rows.
-- Safe to run more than once.

alter table public.list_members
  add column if not exists deleted_at timestamptz;

create table if not exists public.list_members_log (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  user_id uuid not null,
  updated_by_id uuid references public.profiles (id) on delete set null,
  action text not null,
  role text not null,
  created_at timestamptz,
  deleted_at timestamptz
);

drop trigger if exists list_members_log_append_only on public.list_members_log;
create trigger list_members_log_append_only
before update or delete on public.list_members_log
for each row execute function public.reject_log_change();

alter table public.list_members_log enable row level security;

create or replace function public.apply_list_insert(
  p_actor_id uuid,
  p_list_action text,
  p_member_action text,
  p_id uuid,
  p_name text,
  p_description text,
  p_currency text,
  p_created_by_id uuid,
  p_share_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.lists;
  member public.list_members;
begin
  insert into public.lists (
    id, name, description, currency, created_by_id, share_token
  ) values (
    p_id, p_name, p_description, p_currency, p_created_by_id, p_share_token
  )
  returning * into rec;

  insert into public.lists_log (
    list_id, updated_by_id, action, name, description, currency, created_by_id,
    share_token, created_at, updated_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_list_action, rec.name, rec.description, rec.currency, rec.created_by_id,
    rec.share_token, rec.created_at, rec.updated_at, rec.deleted_at
  );

  insert into public.list_members (list_id, user_id, role)
  values (rec.id, p_created_by_id, 'owner')
  returning * into member;

  insert into public.list_members_log (
    list_id, user_id, updated_by_id, action, role, created_at, deleted_at
  ) values (
    member.list_id, member.user_id, p_actor_id, p_member_action, member.role,
    member.created_at, member.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

revoke all on function public.apply_list_insert(uuid, text, text, uuid, text, text, text, uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_list_insert(uuid, text, text, uuid, text, text, text, uuid, text) to service_role;
  end if;
end $$;
