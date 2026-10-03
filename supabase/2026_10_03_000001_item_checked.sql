-- Item bought state. Safe to run more than once.
alter table public.items
  add column if not exists checked boolean not null default false;
