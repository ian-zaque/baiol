-- Append-only log for lists. Share links of deleted lists can be reused.
-- Safe to run more than once.

alter table public.lists drop constraint if exists lists_share_token_key;
drop index if exists public.lists_share_token_idx;
create unique index if not exists lists_share_token_active_idx
  on public.lists (share_token)
  where deleted_at is null;

create table if not exists public.lists_log (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  updated_by_id uuid references public.profiles (id) on delete set null,
  action text not null,
  name text not null,
  description text not null,
  currency text not null,
  created_by_id uuid not null,
  share_token text not null,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
);

drop trigger if exists lists_log_append_only on public.lists_log;
create trigger lists_log_append_only
before update or delete on public.lists_log
for each row execute function public.reject_log_change();

alter table public.lists_log enable row level security;

create or replace function public.apply_list_update(
  p_actor_id uuid,
  p_action text,
  p_list_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.lists;
begin
  update public.lists
  set
    name = case when p_patch ? 'name' then p_patch->>'name' else name end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    currency = case when p_patch ? 'currency' then p_patch->>'currency' else currency end,
    share_token = case when p_patch ? 'share_token' then p_patch->>'share_token' else share_token end
  where id = p_list_id
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'List not found';
  end if;

  insert into public.lists_log (
    list_id, updated_by_id, action, name, description, currency, created_by_id,
    share_token, created_at, updated_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.name, rec.description, rec.currency, rec.created_by_id,
    rec.share_token, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

create or replace function public.apply_list_soft_delete(
  p_actor_id uuid,
  p_action text,
  p_list_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.lists;
begin
  update public.lists
  set deleted_at = now()
  where id = p_list_id
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'List not found';
  end if;

  insert into public.lists_log (
    list_id, updated_by_id, action, name, description, currency, created_by_id,
    share_token, created_at, updated_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.name, rec.description, rec.currency, rec.created_by_id,
    rec.share_token, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

revoke all on function public.apply_list_update(uuid, text, uuid, jsonb) from public;
revoke all on function public.apply_list_soft_delete(uuid, text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_list_update(uuid, text, uuid, jsonb) to service_role;
    grant execute on function public.apply_list_soft_delete(uuid, text, uuid) to service_role;
  end if;
end $$;
