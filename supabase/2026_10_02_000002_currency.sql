-- Additive migration: optional list currency. Missing values become Brazilian reais.
-- Safe to run more than once.

alter table public.lists
  add column if not exists currency text;

update public.lists
set currency = 'BRL'
where currency is null or btrim(currency) = '';

alter table public.lists
  alter column currency set default 'BRL';

do $$
begin
  alter table public.lists alter column currency set not null;
exception
  when others then
    null;
end $$;
