-- Additive migration for databases that already ran schema.sql without share_token.
-- Safe to run more than once.

create extension if not exists "pgcrypto";

alter table public.lists
  add column if not exists share_token text;

update public.lists
set share_token = encode(gen_random_bytes(16), 'hex')
where share_token is null or share_token = '';

alter table public.lists
  alter column share_token set default encode(gen_random_bytes(16), 'hex');

do $$
begin
  alter table public.lists alter column share_token set not null;
exception
  when others then
    null;
end $$;

create unique index if not exists lists_share_token_idx on public.lists (share_token);
