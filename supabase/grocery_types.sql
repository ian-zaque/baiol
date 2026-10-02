-- Additive migration: fixed grocery type catalog and an optional type on each item.
-- Safe to run more than once. Users cannot create, edit, or delete these rows.

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

alter table public.items
  add column if not exists grocery_type_id uuid references public.grocery_types (id);

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

alter table public.grocery_types enable row level security;
