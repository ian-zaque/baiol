-- Split accounts into users and profiles, and replace uuid primary keys with
-- bigint id plus a public uuid. Existing uuid values are kept as uuid.
-- Safe to run more than once. A new database should run schema.sql instead.

create or replace function public._baiol_migrate_users_and_ids()
returns void
language plpgsql
as $fn$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'id'
      and data_type = 'bigint'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'password_hash'
      and data_type = 'text'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    raise exception 'Run supabase/schema.sql on a new database';
  end if;

  execute $sql$
    create table public.users_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      email text not null,
      password_hash text not null,
      created_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.users_next (uuid, email, password_hash, created_at, deleted_at)
    select id, lower(email), password_hash, created_at, deleted_at
    from public.profiles
  $sql$;

  execute $sql$
    create table public.profiles_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique default gen_random_uuid(),
      user_id bigint not null unique references public.users_next (id) on delete cascade,
      display_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.profiles_next (user_id, display_name, created_at, updated_at, deleted_at)
    select u.id, p.display_name, p.created_at, p.created_at, p.deleted_at
    from public.profiles p
    join public.users_next u on u.uuid = p.id
  $sql$;

  execute $sql$
    create table public.lists_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      name text not null,
      description text not null default '',
      currency text not null default 'BRL',
      created_by_id bigint not null references public.users_next (id),
      share_token text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.lists_next (
      uuid, name, description, currency, created_by_id, share_token, created_at, updated_at, deleted_at
    )
    select l.id, l.name, l.description, l.currency, u.id, l.share_token, l.created_at, l.updated_at, l.deleted_at
    from public.lists l
    join public.users_next u on u.uuid = l.created_by_id
  $sql$;

  execute $sql$
    create table public.grocery_types_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      code text not null,
      name text not null,
      sort_order integer not null,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.grocery_types_next (uuid, code, name, sort_order, deleted_at)
    select id, code, name, sort_order, deleted_at
    from public.grocery_types
  $sql$;

  execute $sql$
    create table public.items_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      list_id bigint not null references public.lists_next (id) on delete cascade,
      grocery_type_id bigint references public.grocery_types_next (id) on delete set null,
      name text not null,
      description text not null default '',
      amount text not null default '',
      price numeric(12, 2) not null default 0,
      checked boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.items_next (
      uuid, list_id, grocery_type_id, name, description, amount, price, checked, created_at, updated_at, deleted_at
    )
    select i.id, l.id, g.id, i.name, i.description, i.amount, i.price, coalesce(i.checked, false),
      i.created_at, i.updated_at, i.deleted_at
    from public.items i
    join public.lists_next l on l.uuid = i.list_id
    left join public.grocery_types_next g on g.uuid = i.grocery_type_id
  $sql$;

  execute $sql$
    create table public.list_members_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique default gen_random_uuid(),
      list_id bigint not null references public.lists_next (id) on delete cascade,
      user_id bigint not null references public.users_next (id) on delete cascade,
      role text not null,
      created_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.list_members_next (list_id, user_id, role, created_at, deleted_at)
    select l.id, u.id, m.role, m.created_at, m.deleted_at
    from public.list_members m
    join public.lists_next l on l.uuid = m.list_id
    join public.users_next u on u.uuid = m.user_id
  $sql$;

  execute $sql$
    create table public.list_invites_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      list_id bigint not null references public.lists_next (id) on delete cascade,
      email text not null,
      token text not null,
      invited_by_id bigint not null references public.users_next (id),
      status text not null default 'pending',
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.list_invites_next (
      uuid, list_id, email, token, invited_by_id, status, expires_at, created_at, deleted_at
    )
    select i.id, l.id, i.email, i.token, u.id, i.status, i.expires_at, i.created_at, i.deleted_at
    from public.list_invites i
    join public.lists_next l on l.uuid = i.list_id
    join public.users_next u on u.uuid = i.invited_by_id
  $sql$;

  execute $sql$
    create table public.sessions_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      user_id bigint not null references public.users_next (id) on delete cascade,
      token_hash text not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      revoked_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.sessions_next (uuid, user_id, token_hash, expires_at, created_at, revoked_at)
    select s.id, u.id, s.token_hash, s.expires_at, s.created_at, s.revoked_at
    from public.sessions s
    join public.users_next u on u.uuid = s.profile_id
  $sql$;

  execute $sql$
    create table public.users_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      user_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      email text not null,
      created_at timestamptz,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.users_log_next (uuid, user_id, updated_by_id, action, email, created_at, deleted_at)
    select pl.id, u.id, actor.id, pl.action, lower(pl.email), pl.created_at, pl.deleted_at
    from public.profiles_log pl
    join public.users_next u on u.uuid = pl.profile_id
    left join public.users_next actor on actor.uuid = pl.updated_by_id
  $sql$;

  execute $sql$
    create table public.profiles_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique default gen_random_uuid(),
      profile_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      display_name text,
      created_at timestamptz,
      updated_at timestamptz,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.profiles_log_next (
      profile_id, updated_by_id, action, display_name, created_at, updated_at, deleted_at
    )
    select prof.id, actor.id, pl.action, pl.display_name, pl.created_at, null, pl.deleted_at
    from public.profiles_log pl
    join public.users_next u on u.uuid = pl.profile_id
    join public.profiles_next prof on prof.user_id = u.id
    left join public.users_next actor on actor.uuid = pl.updated_by_id
  $sql$;

  execute $sql$
    create table public.lists_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      list_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      name text not null,
      description text not null,
      currency text not null,
      created_by_id bigint not null,
      share_token text not null,
      created_at timestamptz,
      updated_at timestamptz,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.lists_log_next (
      uuid, list_id, updated_by_id, action, name, description, currency, created_by_id,
      share_token, created_at, updated_at, deleted_at
    )
    select ll.id, l.id, actor.id, ll.action, ll.name, ll.description, ll.currency, owner.id,
      ll.share_token, ll.created_at, ll.updated_at, ll.deleted_at
    from public.lists_log ll
    join public.lists_next l on l.uuid = ll.list_id
    join public.users_next owner on owner.uuid = ll.created_by_id
    left join public.users_next actor on actor.uuid = ll.updated_by_id
  $sql$;

  execute $sql$
    create table public.grocery_types_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      grocery_type_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      code text not null,
      name text not null,
      sort_order integer not null,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.grocery_types_log_next (
      uuid, grocery_type_id, updated_by_id, action, code, name, sort_order, deleted_at
    )
    select gl.id, g.id, actor.id, gl.action, gl.code, gl.name, gl.sort_order, gl.deleted_at
    from public.grocery_types_log gl
    join public.grocery_types_next g on g.uuid = gl.grocery_type_id
    left join public.users_next actor on actor.uuid = gl.updated_by_id
  $sql$;

  execute $sql$
    create table public.items_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      item_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      list_id bigint not null,
      grocery_type_id bigint,
      name text not null,
      description text not null,
      amount text not null,
      price numeric(12, 2) not null,
      checked boolean not null,
      created_at timestamptz,
      updated_at timestamptz,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.items_log_next (
      uuid, item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
      amount, price, checked, created_at, updated_at, deleted_at
    )
    select il.id, item.id, actor.id, il.action, l.id, g.id, il.name, il.description,
      il.amount, il.price, il.checked, il.created_at, il.updated_at, il.deleted_at
    from public.items_log il
    join public.items_next item on item.uuid = il.item_id
    join public.lists_next l on l.uuid = il.list_id
    left join public.grocery_types_next g on g.uuid = il.grocery_type_id
    left join public.users_next actor on actor.uuid = il.updated_by_id
  $sql$;

  execute $sql$
    create table public.list_members_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      list_id bigint not null,
      user_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      role text not null,
      created_at timestamptz,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.list_members_log_next (
      uuid, list_id, user_id, updated_by_id, action, role, created_at, deleted_at
    )
    select ml.id, l.id, u.id, actor.id, ml.action, ml.role, ml.created_at, ml.deleted_at
    from public.list_members_log ml
    join public.lists_next l on l.uuid = ml.list_id
    join public.users_next u on u.uuid = ml.user_id
    left join public.users_next actor on actor.uuid = ml.updated_by_id
  $sql$;

  execute $sql$
    create table public.list_invites_log_next (
      id bigint generated always as identity primary key,
      uuid uuid not null unique,
      list_invite_id bigint not null,
      updated_by_id bigint references public.users_next (id) on delete set null,
      action text not null,
      list_id bigint not null,
      email text not null,
      token text not null,
      invited_by_id bigint not null,
      status text not null,
      expires_at timestamptz not null,
      created_at timestamptz,
      deleted_at timestamptz
    )
  $sql$;
  execute $sql$
    insert into public.list_invites_log_next (
      uuid, list_invite_id, updated_by_id, action, list_id, email, token, invited_by_id,
      status, expires_at, created_at, deleted_at
    )
    select il.id, invite.id, actor.id, il.action, l.id, il.email, il.token, owner.id,
      il.status, il.expires_at, il.created_at, il.deleted_at
    from public.list_invites_log il
    join public.list_invites_next invite on invite.uuid = il.list_invite_id
    join public.lists_next l on l.uuid = il.list_id
    join public.users_next owner on owner.uuid = il.invited_by_id
    left join public.users_next actor on actor.uuid = il.updated_by_id
  $sql$;

  execute 'drop table if exists public.list_invites_log cascade';
  execute 'drop table if exists public.list_members_log cascade';
  execute 'drop table if exists public.items_log cascade';
  execute 'drop table if exists public.lists_log cascade';
  execute 'drop table if exists public.grocery_types_log cascade';
  execute 'drop table if exists public.profiles_log cascade';
  execute 'drop table if exists public.sessions cascade';
  execute 'drop table if exists public.list_invites cascade';
  execute 'drop table if exists public.list_members cascade';
  execute 'drop table if exists public.items cascade';
  execute 'drop table if exists public.lists cascade';
  execute 'drop table if exists public.grocery_types cascade';
  execute 'drop table if exists public.profiles cascade';

  execute 'alter table public.users_next rename to users';
  execute 'alter table public.profiles_next rename to profiles';
  execute 'alter table public.lists_next rename to lists';
  execute 'alter table public.grocery_types_next rename to grocery_types';
  execute 'alter table public.items_next rename to items';
  execute 'alter table public.list_members_next rename to list_members';
  execute 'alter table public.list_invites_next rename to list_invites';
  execute 'alter table public.sessions_next rename to sessions';
  execute 'alter table public.users_log_next rename to users_log';
  execute 'alter table public.profiles_log_next rename to profiles_log';
  execute 'alter table public.lists_log_next rename to lists_log';
  execute 'alter table public.grocery_types_log_next rename to grocery_types_log';
  execute 'alter table public.items_log_next rename to items_log';
  execute 'alter table public.list_members_log_next rename to list_members_log';
  execute 'alter table public.list_invites_log_next rename to list_invites_log';

  execute 'create unique index if not exists users_email_active_idx on public.users (lower(email)) where deleted_at is null';
  execute 'create index if not exists lists_created_by_id_idx on public.lists (created_by_id)';
  execute 'create unique index if not exists lists_share_token_active_idx on public.lists (share_token) where deleted_at is null';
  execute 'create unique index if not exists grocery_types_code_active_idx on public.grocery_types (code) where deleted_at is null';
  execute 'create index if not exists items_list_id_idx on public.items (list_id)';
  execute 'create index if not exists items_grocery_type_id_idx on public.items (grocery_type_id)';
  execute 'create unique index if not exists list_members_list_user_active_idx on public.list_members (list_id, user_id) where deleted_at is null';
  execute 'create index if not exists list_members_user_id_idx on public.list_members (user_id)';
  execute 'create unique index if not exists list_invites_token_active_idx on public.list_invites (token) where deleted_at is null';
  execute 'create unique index if not exists list_invites_list_email_idx on public.list_invites (list_id, lower(email)) where deleted_at is null';
  execute 'create index if not exists list_invites_email_idx on public.list_invites (lower(email))';
  execute 'create unique index if not exists sessions_token_hash_active_idx on public.sessions (token_hash) where revoked_at is null';

  execute 'alter table public.users enable row level security';
  execute 'alter table public.profiles enable row level security';
  execute 'alter table public.lists enable row level security';
  execute 'alter table public.grocery_types enable row level security';
  execute 'alter table public.items enable row level security';
  execute 'alter table public.list_members enable row level security';
  execute 'alter table public.list_invites enable row level security';
  execute 'alter table public.sessions enable row level security';
  execute 'alter table public.users_log enable row level security';
  execute 'alter table public.profiles_log enable row level security';
  execute 'alter table public.lists_log enable row level security';
  execute 'alter table public.grocery_types_log enable row level security';
  execute 'alter table public.items_log enable row level security';
  execute 'alter table public.list_members_log enable row level security';
  execute 'alter table public.list_invites_log enable row level security';
end;
$fn$;

select public._baiol_migrate_users_and_ids();
drop function public._baiol_migrate_users_and_ids();
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
before update on public.lists
for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

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
-- Append-only logs
-- ---------------------------------------------------------------------------
create or replace function public.reject_log_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

create table if not exists public.users_log (
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  user_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  email text not null,
  created_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.profiles_log (
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  profile_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  display_name text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.lists_log (
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  list_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  name text not null,
  description text not null,
  currency text not null,
  created_by_id bigint not null,
  share_token text not null,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.grocery_types_log (
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  grocery_type_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  code text not null,
  name text not null,
  sort_order integer not null,
  deleted_at timestamptz
);

create table if not exists public.items_log (
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  item_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  list_id bigint not null,
  grocery_type_id bigint,
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
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  list_id bigint not null,
  user_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  role text not null,
  created_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.list_invites_log (
  id bigint generated always as identity primary key,
  uuid uuid not null unique default gen_random_uuid(),
  list_invite_id bigint not null,
  updated_by_id bigint references public.users (id) on delete set null,
  action text not null,
  list_id bigint not null,
  email text not null,
  token text not null,
  invited_by_id bigint not null,
  status text not null,
  expires_at timestamptz not null,
  created_at timestamptz,
  deleted_at timestamptz
);

drop trigger if exists users_log_append_only on public.users_log;
create trigger users_log_append_only
before update or delete on public.users_log
for each row execute function public.reject_log_change();

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

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.grocery_types enable row level security;
alter table public.items enable row level security;
alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;
alter table public.sessions enable row level security;
alter table public.users_log enable row level security;
alter table public.profiles_log enable row level security;
alter table public.lists_log enable row level security;
alter table public.grocery_types_log enable row level security;
alter table public.items_log enable row level security;
alter table public.list_members_log enable row level security;
alter table public.list_invites_log enable row level security;

-- No policies for authenticated/anon => no direct client access.
-- Service role bypasses RLS by design.

-- ---------------------------------------------------------------------------
-- Resolve a public uuid to the bigint primary key. Null stays null.
-- ---------------------------------------------------------------------------
create or replace function public.user_pk(p_uuid uuid)
returns bigint language sql stable as $$
  select id from public.users where uuid = p_uuid
$$;

create or replace function public.list_pk(p_uuid uuid)
returns bigint language sql stable as $$
  select id from public.lists where uuid = p_uuid
$$;

create or replace function public.item_pk(p_uuid uuid)
returns bigint language sql stable as $$
  select id from public.items where uuid = p_uuid
$$;

create or replace function public.grocery_pk(p_uuid uuid)
returns bigint language sql stable as $$
  select id from public.grocery_types where uuid = p_uuid and deleted_at is null
$$;

create or replace function public.public_account(p_user public.users, p_profile public.profiles)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_user.uuid,
    'email', p_user.email,
    'display_name', p_profile.display_name,
    'created_at', p_user.created_at
  )
$$;

create or replace function public.public_list(p_list public.lists)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_list.uuid,
    'name', p_list.name,
    'description', p_list.description,
    'currency', p_list.currency,
    'created_by_id', (select uuid from public.users where id = p_list.created_by_id),
    'share_token', p_list.share_token,
    'created_at', p_list.created_at,
    'updated_at', p_list.updated_at,
    'deleted_at', p_list.deleted_at
  )
$$;

create or replace function public.public_item(p_item public.items)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_item.uuid,
    'list_id', (select uuid from public.lists where id = p_item.list_id),
    'grocery_type_id', (select uuid from public.grocery_types where id = p_item.grocery_type_id),
    'name', p_item.name,
    'description', p_item.description,
    'amount', p_item.amount,
    'price', p_item.price,
    'checked', p_item.checked,
    'created_at', p_item.created_at,
    'updated_at', p_item.updated_at,
    'deleted_at', p_item.deleted_at
  )
$$;

drop function if exists public.apply_profile_insert(uuid, text, uuid, text, text);
drop function if exists public.apply_profile_insert(uuid, text, uuid, text, text, text);
drop function if exists public.apply_profile_update(uuid, text, uuid, jsonb);

create or replace function public.apply_user_insert(
  p_actor_uuid uuid,
  p_user_action text,
  p_profile_action text,
  p_user_uuid uuid,
  p_profile_uuid uuid,
  p_email text,
  p_display_name text,
  p_password_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  usr public.users;
  prof public.profiles;
begin
  insert into public.users (uuid, email, password_hash)
  values (p_user_uuid, p_email, p_password_hash)
  returning * into usr;

  if actor_id is null then
    actor_id := usr.id;
  end if;

  insert into public.profiles (uuid, user_id, display_name)
  values (p_profile_uuid, usr.id, p_display_name)
  returning * into prof;

  insert into public.users_log (user_id, updated_by_id, action, email, created_at, deleted_at)
  values (usr.id, actor_id, p_user_action, usr.email, usr.created_at, usr.deleted_at);

  insert into public.profiles_log (
    profile_id, updated_by_id, action, display_name, created_at, updated_at, deleted_at
  ) values (
    prof.id, actor_id, p_profile_action, prof.display_name, prof.created_at, prof.updated_at, prof.deleted_at
  );

  return public.public_account(usr, prof);
end;
$$;

create or replace function public.apply_profile_update(
  p_actor_uuid uuid,
  p_action text,
  p_user_uuid uuid,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  usr public.users;
  prof public.profiles;
begin
  select * into usr from public.users where uuid = p_user_uuid and deleted_at is null;
  if not found then
    raise exception 'User not found';
  end if;

  update public.profiles
  set display_name = p_display_name
  where user_id = usr.id
    and deleted_at is null
  returning * into prof;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.profiles_log (
    profile_id, updated_by_id, action, display_name, created_at, updated_at, deleted_at
  ) values (
    prof.id, actor_id, p_action, prof.display_name, prof.created_at, prof.updated_at, prof.deleted_at
  );

  return public.public_account(usr, prof);
end;
$$;

revoke all on function public.apply_user_insert(uuid, text, text, uuid, uuid, text, text, text) from public;
revoke all on function public.apply_profile_update(uuid, text, uuid, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_user_insert(uuid, text, text, uuid, uuid, text, text, text) to service_role;
    grant execute on function public.apply_profile_update(uuid, text, uuid, text) to service_role;
  end if;
end $$;

create or replace function public.apply_list_insert(
  p_actor_uuid uuid,
  p_list_action text,
  p_member_action text,
  p_list_uuid uuid,
  p_name text,
  p_description text,
  p_currency text,
  p_created_by_uuid uuid,
  p_share_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  owner_id bigint := public.user_pk(p_created_by_uuid);
  rec public.lists;
  member public.list_members;
begin
  if owner_id is null then
    raise exception 'User not found';
  end if;

  insert into public.lists (uuid, name, description, currency, created_by_id, share_token)
  values (p_list_uuid, p_name, p_description, p_currency, owner_id, p_share_token)
  returning * into rec;

  insert into public.lists_log (
    list_id, updated_by_id, action, name, description, currency, created_by_id,
    share_token, created_at, updated_at, deleted_at
  ) values (
    rec.id, actor_id, p_list_action, rec.name, rec.description, rec.currency, rec.created_by_id,
    rec.share_token, rec.created_at, rec.updated_at, rec.deleted_at
  );

  insert into public.list_members (list_id, user_id, role)
  values (rec.id, owner_id, 'owner')
  returning * into member;

  insert into public.list_members_log (
    list_id, user_id, updated_by_id, action, role, created_at, deleted_at
  ) values (
    member.list_id, member.user_id, actor_id, p_member_action, member.role,
    member.created_at, member.deleted_at
  );

  return public.public_list(rec);
end;
$$;

create or replace function public.apply_list_update(
  p_actor_uuid uuid,
  p_action text,
  p_list_uuid uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  rec public.lists;
begin
  update public.lists
  set
    name = case when p_patch ? 'name' then p_patch->>'name' else name end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    currency = case when p_patch ? 'currency' then p_patch->>'currency' else currency end,
    share_token = case when p_patch ? 'share_token' then p_patch->>'share_token' else share_token end
  where uuid = p_list_uuid
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'List not found';
  end if;

  insert into public.lists_log (
    list_id, updated_by_id, action, name, description, currency, created_by_id,
    share_token, created_at, updated_at, deleted_at
  ) values (
    rec.id, actor_id, p_action, rec.name, rec.description, rec.currency, rec.created_by_id,
    rec.share_token, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return public.public_list(rec);
end;
$$;

create or replace function public.apply_list_soft_delete(
  p_actor_uuid uuid,
  p_action text,
  p_list_uuid uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  rec public.lists;
begin
  update public.lists
  set deleted_at = now()
  where uuid = p_list_uuid
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'List not found';
  end if;

  insert into public.lists_log (
    list_id, updated_by_id, action, name, description, currency, created_by_id,
    share_token, created_at, updated_at, deleted_at
  ) values (
    rec.id, actor_id, p_action, rec.name, rec.description, rec.currency, rec.created_by_id,
    rec.share_token, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return public.public_list(rec);
end;
$$;

revoke all on function public.apply_list_insert(uuid, text, text, uuid, text, text, text, uuid, text) from public;
revoke all on function public.apply_list_update(uuid, text, uuid, jsonb) from public;
revoke all on function public.apply_list_soft_delete(uuid, text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_list_insert(uuid, text, text, uuid, text, text, text, uuid, text) to service_role;
    grant execute on function public.apply_list_update(uuid, text, uuid, jsonb) to service_role;
    grant execute on function public.apply_list_soft_delete(uuid, text, uuid) to service_role;
  end if;
end $$;

create or replace function public.apply_item_insert(
  p_actor_uuid uuid,
  p_action text,
  p_item_uuid uuid,
  p_list_uuid uuid,
  p_grocery_type_uuid uuid,
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
  actor_id bigint := public.user_pk(p_actor_uuid);
  list_id bigint := public.list_pk(p_list_uuid);
  type_id bigint := public.grocery_pk(p_grocery_type_uuid);
  rec public.items;
begin
  if list_id is null then
    raise exception 'List not found';
  end if;
  if p_grocery_type_uuid is not null and type_id is null then
    raise exception 'Unknown grocery type';
  end if;

  insert into public.items (
    uuid, list_id, grocery_type_id, name, description, amount, price, checked
  ) values (
    p_item_uuid, list_id, type_id, p_name, p_description, p_amount, p_price, coalesce(p_checked, false)
  )
  returning * into rec;

  insert into public.items_log (
    item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
    amount, price, checked, created_at, updated_at, deleted_at
  ) values (
    rec.id, actor_id, p_action, rec.list_id, rec.grocery_type_id, rec.name, rec.description,
    rec.amount, rec.price, rec.checked, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return public.public_item(rec);
end;
$$;

create or replace function public.apply_item_update(
  p_actor_uuid uuid,
  p_action text,
  p_item_uuid uuid,
  p_list_uuid uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  list_id bigint := public.list_pk(p_list_uuid);
  type_id bigint;
  rec public.items;
begin
  if list_id is null then
    raise exception 'List not found';
  end if;
  if p_patch ? 'grocery_type_id' and nullif(p_patch->>'grocery_type_id', '') is not null then
    type_id := public.grocery_pk((p_patch->>'grocery_type_id')::uuid);
    if type_id is null then
      raise exception 'Unknown grocery type';
    end if;
  end if;

  update public.items
  set
    name = case when p_patch ? 'name' then p_patch->>'name' else name end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    amount = case when p_patch ? 'amount' then p_patch->>'amount' else amount end,
    price = case when p_patch ? 'price' then (p_patch->>'price')::numeric else price end,
    checked = case when p_patch ? 'checked' then (p_patch->>'checked')::boolean else checked end,
    grocery_type_id = case
      when p_patch ? 'grocery_type_id' and nullif(p_patch->>'grocery_type_id', '') is null then null
      when p_patch ? 'grocery_type_id' then type_id
      else grocery_type_id
    end
  where uuid = p_item_uuid
    and list_id = list_id
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'Item not found';
  end if;

  insert into public.items_log (
    item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
    amount, price, checked, created_at, updated_at, deleted_at
  ) values (
    rec.id, actor_id, p_action, rec.list_id, rec.grocery_type_id, rec.name, rec.description,
    rec.amount, rec.price, rec.checked, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return public.public_item(rec);
end;
$$;

create or replace function public.apply_item_soft_delete(
  p_actor_uuid uuid,
  p_action text,
  p_item_uuid uuid,
  p_list_uuid uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id bigint := public.user_pk(p_actor_uuid);
  list_id bigint := public.list_pk(p_list_uuid);
  rec public.items;
begin
  if list_id is null then
    raise exception 'List not found';
  end if;

  update public.items
  set deleted_at = now()
  where uuid = p_item_uuid
    and list_id = list_id
    and deleted_at is null
  returning * into rec;

  if not found then
    raise exception 'Item not found';
  end if;

  insert into public.items_log (
    item_id, updated_by_id, action, list_id, grocery_type_id, name, description,
    amount, price, checked, created_at, updated_at, deleted_at
  ) values (
    rec.id, actor_id, p_action, rec.list_id, rec.grocery_type_id, rec.name, rec.description,
    rec.amount, rec.price, rec.checked, rec.created_at, rec.updated_at, rec.deleted_at
  );

  return public.public_item(rec);
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
