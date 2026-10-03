-- Soft-delete and append-only log for list invites.
-- Safe to run more than once. Nothing in the API writes this table yet.

alter table public.list_invites
  add column if not exists deleted_at timestamptz;

alter table public.list_invites drop constraint if exists list_invites_token_key;
drop index if exists public.list_invites_token_idx;
create unique index if not exists list_invites_token_active_idx
  on public.list_invites (token)
  where deleted_at is null;

drop index if exists public.list_invites_list_email_idx;
create unique index list_invites_list_email_idx
  on public.list_invites (list_id, lower(email))
  where deleted_at is null;

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

drop trigger if exists list_invites_log_append_only on public.list_invites_log;
create trigger list_invites_log_append_only
before update or delete on public.list_invites_log
for each row execute function public.reject_log_change();

alter table public.list_invites_log enable row level security;
