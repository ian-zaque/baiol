-- Baiol grocery lists schema
-- Run this in the Supabase SQL editor after creating a project.
-- Auth remains in auth.users; this file adds app tables, a profile trigger, and RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists profiles_email_active_idx
  on public.profiles (lower(email))
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  currency text not null default 'BRL' check (currency in (
    'BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'NZD',
    'CHF', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'PYG', 'KRW',
    'ZAR', 'TRY', 'SEK', 'NOK', 'DKK', 'PLN', 'RUB', 'AED', 'SAR', 'ILS',
    'HKD', 'SGD', 'THB', 'PHP', 'IDR', 'VND', 'EGP', 'NGN'
  )),
  created_by_id uuid not null references public.profiles (id),
  share_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists lists_created_by_id_idx on public.lists (created_by_id);
create unique index if not exists lists_share_token_active_idx
  on public.lists (share_token)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Grocery types (catalog). Users select one; they do not edit this table.
-- ---------------------------------------------------------------------------
create table if not exists public.grocery_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  sort_order integer not null,
  deleted_at timestamptz
);

create unique index if not exists grocery_types_code_active_idx
  on public.grocery_types (code)
  where deleted_at is null;

insert into public.grocery_types (code, name, sort_order)
values
  ('meat', 'Meat', 10),
  ('protein', 'Protein', 20),
  ('dairy', 'Dairy', 30),
  ('bakery', 'Bakery', 40),
  ('fruits', 'Fruits', 50),
  ('vegetables', 'Vegetables', 60),
  ('grains', 'Grains', 70),
  ('canned_foods', 'Canned Foods', 80),
  ('condiments', 'Condiments', 90),
  ('snacks', 'Snacks', 100),
  ('beverages', 'Beverages', 110),
  ('household', 'Household', 120),
  ('personal_care', 'Personal Care', 130),
  ('other', 'Other', 140)
on conflict (code) where deleted_at is null do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  grocery_type_id uuid references public.grocery_types (id) on delete set null,
  name text not null,
  description text not null default '',
  amount text not null default '',
  price numeric(12, 2) not null default 0,
  checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists items_list_id_idx on public.items (list_id);
create index if not exists items_grocery_type_id_idx on public.items (grocery_type_id);

update public.items
set grocery_type_id = null
where grocery_type_id in (
  select id
  from public.grocery_types
  where code not in (
    'meat', 'protein', 'dairy', 'bakery', 'fruits', 'vegetables', 'grains',
    'canned_foods', 'condiments', 'snacks', 'beverages', 'household',
    'personal_care', 'other'
  )
);

delete from public.grocery_types
where code not in (
  'meat', 'protein', 'dairy', 'bakery', 'fruits', 'vegetables', 'grains',
  'canned_foods', 'condiments', 'snacks', 'beverages', 'household',
  'personal_care', 'other'
);

-- ---------------------------------------------------------------------------
-- Membership (access control)
-- ---------------------------------------------------------------------------
create table if not exists public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (list_id, user_id)
);

create index if not exists list_members_user_id_idx on public.list_members (user_id);

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
create table if not exists public.list_invites (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  email text not null,
  token text not null,
  invited_by_id uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists list_invites_token_active_idx
  on public.list_invites (token)
  where deleted_at is null;
create unique index if not exists list_invites_list_email_idx
  on public.list_invites (list_id, lower(email))
  where deleted_at is null;
create index if not exists list_invites_email_idx on public.list_invites (lower(email));

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

-- Item writes and the parent list timestamp commit together.
create or replace function public.touch_list_from_item()
returns trigger
language plpgsql
as $$
begin
  update public.lists
  set updated_at = now()
  where id = coalesce(new.list_id, old.list_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists items_touch_list on public.items;
create trigger items_touch_list
after insert or update or delete on public.items
for each row execute function public.touch_list_from_item();

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a user registers
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Append-only logs. The API writes these from the service that performs
-- the change, inside the same database function as the entity write.
-- ---------------------------------------------------------------------------
create or replace function public.reject_log_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

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

create table if not exists public.grocery_types_log (
  id uuid primary key default gen_random_uuid(),
  grocery_type_id uuid not null,
  updated_by_id uuid references public.profiles (id) on delete set null,
  action text not null,
  code text not null,
  name text not null,
  sort_order integer not null,
  deleted_at timestamptz
);

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

create table if not exists public.list_invites_log (
  id uuid primary key default gen_random_uuid(),
  list_invite_id uuid not null,
  updated_by_id uuid references public.profiles (id) on delete set null,
  action text not null,
  list_id uuid not null,
  email text not null,
  token text not null,
  invited_by_id uuid not null,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz,
  deleted_at timestamptz
);

drop trigger if exists profiles_log_append_only on public.profiles_log;
create trigger profiles_log_append_only
before update or delete on public.profiles_log
for each row execute function public.reject_log_change();

drop trigger if exists lists_log_append_only on public.lists_log;
create trigger lists_log_append_only
before update or delete on public.lists_log
for each row execute function public.reject_log_change();

drop trigger if exists grocery_types_log_append_only on public.grocery_types_log;
create trigger grocery_types_log_append_only
before update or delete on public.grocery_types_log
for each row execute function public.reject_log_change();

drop trigger if exists items_log_append_only on public.items_log;
create trigger items_log_append_only
before update or delete on public.items_log
for each row execute function public.reject_log_change();

drop trigger if exists list_members_log_append_only on public.list_members_log;
create trigger list_members_log_append_only
before update or delete on public.list_members_log
for each row execute function public.reject_log_change();

drop trigger if exists list_invites_log_append_only on public.list_invites_log;
create trigger list_invites_log_append_only
before update or delete on public.list_invites_log
for each row execute function public.reject_log_change();

-- ---------------------------------------------------------------------------
-- RLS as defense-in-depth.
-- The NestJS API uses the service role (bypasses RLS).
-- Anon/authenticated clients cannot read or write app tables directly.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.grocery_types enable row level security;
alter table public.items enable row level security;
alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;
alter table public.profiles_log enable row level security;
alter table public.lists_log enable row level security;
alter table public.grocery_types_log enable row level security;
alter table public.items_log enable row level security;
alter table public.list_members_log enable row level security;
alter table public.list_invites_log enable row level security;

drop policy if exists "service_role_all_profiles" on public.profiles;
drop policy if exists "service_role_all_lists" on public.lists;
drop policy if exists "service_role_all_items" on public.items;
drop policy if exists "service_role_all_list_members" on public.list_members;
drop policy if exists "service_role_all_list_invites" on public.list_invites;

-- No policies for authenticated/anon => no direct client access.
-- Service role bypasses RLS by design.

-- ---------------------------------------------------------------------------
-- Entity writes and their log rows share one transaction.
-- ---------------------------------------------------------------------------
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

