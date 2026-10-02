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
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  currency text not null default 'BRL',
  created_by_id uuid not null references public.profiles (id),
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists lists_created_by_id_idx on public.lists (created_by_id);
create unique index if not exists lists_share_token_idx on public.lists (share_token);

-- ---------------------------------------------------------------------------
-- Grocery types (catalog). Users select one; they do not edit this table.
-- ---------------------------------------------------------------------------
create table if not exists public.grocery_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null
);

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
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  grocery_type_id uuid references public.grocery_types (id),
  name text not null,
  description text not null default '',
  amount text not null default '',
  price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists items_list_id_idx on public.items (list_id);

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
  token text not null unique,
  invited_by_id uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (list_id, email)
);

create index if not exists list_invites_email_idx on public.list_invites (lower(email));
create index if not exists list_invites_token_idx on public.list_invites (token);

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

drop policy if exists "service_role_all_profiles" on public.profiles;
drop policy if exists "service_role_all_lists" on public.lists;
drop policy if exists "service_role_all_items" on public.items;
drop policy if exists "service_role_all_list_members" on public.list_members;
drop policy if exists "service_role_all_list_invites" on public.list_invites;

-- No policies for authenticated/anon => no direct client access.
-- Service role bypasses RLS by design.
