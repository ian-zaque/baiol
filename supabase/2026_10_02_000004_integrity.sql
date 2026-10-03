-- Fixes for a database created before these constraints and the item trigger.
-- Safe to run more than once. Run after 2026_10_02_000001_share_token.sql, 2026_10_02_000002_currency.sql, and 2026_10_02_000003_grocery_types.sql.

-- Currency must be one of the codes the API accepts.
update public.lists
set currency = 'BRL'
where currency is null
   or btrim(currency) = ''
   or currency not in (
     'BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'NZD',
     'CHF', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'PYG', 'KRW',
     'ZAR', 'TRY', 'SEK', 'NOK', 'DKK', 'PLN', 'RUB', 'AED', 'SAR', 'ILS',
     'HKD', 'SGD', 'THB', 'PHP', 'IDR', 'VND', 'EGP', 'NGN'
   );

alter table public.lists drop constraint if exists lists_currency_check;
alter table public.lists
  add constraint lists_currency_check check (currency in (
    'BRL', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'NZD',
    'CHF', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'BOB', 'PYG', 'KRW',
    'ZAR', 'TRY', 'SEK', 'NOK', 'DKK', 'PLN', 'RUB', 'AED', 'SAR', 'ILS',
    'HKD', 'SGD', 'THB', 'PHP', 'IDR', 'VND', 'EGP', 'NGN'
  ));

-- Drop a second unique index only when the column constraint already enforces uniqueness.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'lists_share_token_key'
      and conrelid = 'public.lists'::regclass
  ) then
    drop index if exists public.lists_share_token_idx;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'list_invites_token_key'
      and conrelid = 'public.list_invites'::regclass
  ) then
    drop index if exists public.list_invites_token_idx;
  end if;
end $$;

-- One invite per list and email, ignoring case.
alter table public.list_invites drop constraint if exists list_invites_list_id_email_key;
create unique index if not exists list_invites_list_email_idx
  on public.list_invites (list_id, lower(email));

-- Clearing a grocery type should not block deleting that catalog row.
create index if not exists items_grocery_type_id_idx on public.items (grocery_type_id);

alter table public.items drop constraint if exists items_grocery_type_id_fkey;
alter table public.items
  add constraint items_grocery_type_id_fkey
  foreign key (grocery_type_id) references public.grocery_types (id) on delete set null;

-- Keep lists.updated_at in the same transaction as the item write.
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
