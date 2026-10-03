-- Append-only log for items.
-- Safe to run more than once.

create table if not exists public.items_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  updated_by_id uuid references public.profiles (id) on delete set null,
  action text not null,
  list_id uuid not null,
  grocery_type_id uuid,
  name text not null,
  description text not null,
  amount text not null,
  price numeric(12, 2) not null,
  checked boolean not null,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
);

drop trigger if exists items_log_append_only on public.items_log;
create trigger items_log_append_only
before update or delete on public.items_log
for each row execute function public.reject_log_change();

alter table public.items_log enable row level security;

create or replace function public.apply_item_insert(
  p_actor_id uuid,
  p_action text,
  p_id uuid,
  p_list_id uuid,
  p_grocery_type_id uuid,
  p_name text,
  p_description text,
  p_amount text,
  p_price numeric,
  p_checked boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.items;
begin
  insert into public.items (
    id, list_id, grocery_type_id, name, description, amount, price, checked
  ) values (
    p_id, p_list_id, p_grocery_type_id, p_name, p_description, p_amount, p_price, coalesce(p_checked, false)
  )
  returning * into rec;

  insert into public.items_log (
    item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
    amount, price, checked, created_at, updated_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.list_id, rec.grocery_type_id, rec.name, rec.description,
    rec.amount, rec.price, rec.checked, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

create or replace function public.apply_item_update(
  p_actor_id uuid,
  p_action text,
  p_item_id uuid,
  p_list_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.items;
begin
  update public.items
  set
    name = case when p_patch ? 'name' then p_patch->>'name' else name end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    amount = case when p_patch ? 'amount' then p_patch->>'amount' else amount end,
    price = case when p_patch ? 'price' then (p_patch->>'price')::numeric else price end,
    checked = case when p_patch ? 'checked' then (p_patch->>'checked')::boolean else checked end,
    grocery_type_id = case
      when p_patch ? 'grocery_type_id' then nullif(p_patch->>'grocery_type_id', '')::uuid
      else grocery_type_id
    end
  where id = p_item_id
    and list_id = p_list_id
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'Item not found';
  end if;

  insert into public.items_log (
    item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
    amount, price, checked, created_at, updated_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.list_id, rec.grocery_type_id, rec.name, rec.description,
    rec.amount, rec.price, rec.checked, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

create or replace function public.apply_item_soft_delete(
  p_actor_id uuid,
  p_action text,
  p_item_id uuid,
  p_list_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.items;
begin
  update public.items
  set deleted_at = now()
  where id = p_item_id
    and list_id = p_list_id
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'Item not found';
  end if;

  insert into public.items_log (
    item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
    amount, price, checked, created_at, updated_at, deleted_at
  ) values (
    rec.id, p_actor_id, p_action, rec.list_id, rec.grocery_type_id, rec.name, rec.description,
    rec.amount, rec.price, rec.checked, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return to_jsonb(rec);
end;
$$;

revoke all on function public.apply_item_insert(uuid, text, uuid, uuid, uuid, text, text, text, numeric, boolean) from public;
revoke all on function public.apply_item_update(uuid, text, uuid, uuid, jsonb) from public;
revoke all on function public.apply_item_soft_delete(uuid, text, uuid, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_item_insert(uuid, text, uuid, uuid, uuid, text, text, text, numeric, boolean) to service_role;
    grant execute on function public.apply_item_update(uuid, text, uuid, uuid, jsonb) to service_role;
    grant execute on function public.apply_item_soft_delete(uuid, text, uuid, uuid) to service_role;
  end if;
end $$;
