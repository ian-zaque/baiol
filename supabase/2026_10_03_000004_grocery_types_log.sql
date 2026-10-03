-- Soft-delete and append-only log for grocery types.
-- Safe to run more than once. Nothing in the API writes this table yet.

alter table public.grocery_types
  add column if not exists deleted_at timestamptz;

alter table public.grocery_types drop constraint if exists grocery_types_code_key;
drop index if exists public.grocery_types_code_idx;
create unique index if not exists grocery_types_code_active_idx
  on public.grocery_types (code)
  where deleted_at is null;

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

drop trigger if exists grocery_types_log_append_only on public.grocery_types_log;
create trigger grocery_types_log_append_only
before update or delete on public.grocery_types_log
for each row execute function public.reject_log_change();

alter table public.grocery_types_log enable row level security;
