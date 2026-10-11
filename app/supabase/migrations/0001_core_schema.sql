-- Sunday Board v1 schema. See docs/data-model.md for the plain-language version.
--
-- Rules that hold everywhere:
--  * Every family-owned row carries family_id.
--  * Row-level security: you can only see or change rows of the family you belong to.
--  * Links between family-owned rows use (id, family_id) foreign keys, so a row can
--    never point at another family's data.
--  * A person belongs to one family at a time (family_members.user_id is unique).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Families
-- ---------------------------------------------------------------------------
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  invite_code text not null unique
              default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at  timestamptz not null default now()
);

create table public.family_members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null default '' check (length(display_name) <= 60),
  joined_at    timestamptz not null default now()
);
create index on public.family_members (family_id);

-- The family of whoever is signed in (null if none). Used by every policy.
create function public.my_family_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.family_id from public.family_members m where m.user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Core: categories, stores, items, item history
-- ---------------------------------------------------------------------------
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  parent_id     uuid,
  name          text not null check (length(trim(name)) between 1 and 60),
  sort          int not null default 0,
  default_restock_mode text check (default_restock_mode in ('staple', 'as_needed')),
  created_at    timestamptz not null default now(),
  unique (id, family_id),
  foreign key (parent_id, family_id) references public.categories (id, family_id) on delete cascade,
  check (parent_id is distinct from id)
);
create index on public.categories (family_id, parent_id);

create table public.stores (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
create unique index stores_family_name on public.stores (family_id, lower(name));

-- The shared, read-only catalogue ("universe" of household products).
create table public.catalog_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  aliases       text[] not null default '{}',
  category_path text[] not null default '{}',
  restock_mode  text not null default 'as_needed' check (restock_mode in ('staple', 'as_needed')),
  tags          text[] not null default '{}',
  sizes         text[] not null default '{}',
  search_text   text not null default ''
);
create index catalog_items_search on public.catalog_items
  using gin (search_text extensions.gin_trgm_ops);

create table public.starter_packs (
  id          text primary key,
  name        text not null,
  description text not null default '',
  sort        int not null default 0
);

create table public.starter_pack_items (
  pack_id         text not null references public.starter_packs (id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items (id) on delete cascade,
  primary key (pack_id, catalog_item_id)
);

create table public.items (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  category_id        uuid,
  catalog_item_id    uuid references public.catalog_items (id) on delete set null,
  name               text not null check (length(trim(name)) between 1 and 80),
  restock_mode       text not null default 'as_needed' check (restock_mode in ('staple', 'as_needed')),
  restock_every_days int check (restock_every_days between 1 and 730),
  learned_every_days int check (learned_every_days between 1 and 730),
  usual_amount       text check (length(usual_amount) <= 40),
  notes              text not null default '' check (length(notes) <= 500),
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, family_id),
  foreign key (category_id, family_id) references public.categories (id, family_id) on delete set null (category_id)
);
-- No two live items with the same name in one family (TenBy12 had duplicates).
create unique index items_family_name on public.items (family_id, lower(name)) where archived_at is null;
create index on public.items (family_id, category_id);
create index items_name_search on public.items using gin (lower(name) extensions.gin_trgm_ops);
create index on public.items (catalog_item_id);

create table public.item_stores (
  item_id   uuid not null,
  store_id  uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  preferred boolean not null default false,
  primary key (item_id, store_id),
  foreign key (item_id, family_id) references public.items (id, family_id) on delete cascade,
  foreign key (store_id, family_id) references public.stores (id, family_id) on delete cascade
);
create index on public.item_stores (store_id, family_id);
create index on public.item_stores (item_id, family_id);

create table public.item_events (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  item_id     uuid not null,
  kind        text not null check (kind in ('bought', 'have_it')),
  happened_on date not null default current_date,
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  store_id    uuid,
  created_at  timestamptz not null default now(),
  foreign key (item_id, family_id) references public.items (id, family_id) on delete cascade,
  foreign key (store_id, family_id) references public.stores (id, family_id) on delete set null (store_id)
);
create index on public.item_events (item_id, happened_on desc);
create index on public.item_events (family_id);
create index on public.item_events (user_id);
create index on public.item_events (store_id, family_id);
create index on public.item_events (item_id, family_id);

-- ---------------------------------------------------------------------------
-- Meals
-- ---------------------------------------------------------------------------
create table public.meal_types (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 40),
  sort       int not null default 0,
  usual_time time,
  unique (id, family_id)
);
create unique index meal_types_family_name on public.meal_types (family_id, lower(name));

create table public.dishes (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 80),
  notes           text not null default '' check (length(notes) <= 2000),
  make_every_days int check (make_every_days between 1 and 730),
  weekdays_ok     boolean not null default true,
  weekends_ok     boolean not null default true,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (id, family_id)
);
create unique index dishes_family_name on public.dishes (family_id, lower(name)) where archived_at is null;

create table public.dish_meal_types (
  dish_id      uuid not null,
  meal_type_id uuid not null,
  family_id    uuid not null references public.families (id) on delete cascade,
  primary key (dish_id, meal_type_id),
  foreign key (dish_id, family_id) references public.dishes (id, family_id) on delete cascade,
  foreign key (meal_type_id, family_id) references public.meal_types (id, family_id) on delete cascade
);
create index on public.dish_meal_types (meal_type_id, family_id);
create index on public.dish_meal_types (dish_id, family_id);

create table public.dish_ingredients (
  dish_id   uuid not null,
  item_id   uuid not null,
  family_id uuid not null references public.families (id) on delete cascade,
  amount    text check (length(amount) <= 40),
  primary key (dish_id, item_id),
  foreign key (dish_id, family_id) references public.dishes (id, family_id) on delete cascade,
  foreign key (item_id, family_id) references public.items (id, family_id) on delete cascade
);
create index on public.dish_ingredients (item_id, family_id);
create index on public.dish_ingredients (dish_id, family_id);

create table public.dish_prep_steps (
  id           uuid primary key default gen_random_uuid(),
  dish_id      uuid not null,
  family_id    uuid not null references public.families (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  lead_minutes int not null check (lead_minutes between 0 and 20160),
  sort         int not null default 0,
  unique (id, family_id),
  foreign key (dish_id, family_id) references public.dishes (id, family_id) on delete cascade
);
create index on public.dish_prep_steps (dish_id, family_id);

create table public.meal_type_items (
  meal_type_id uuid not null,
  item_id      uuid not null,
  family_id    uuid not null references public.families (id) on delete cascade,
  primary key (meal_type_id, item_id),
  foreign key (meal_type_id, family_id) references public.meal_types (id, family_id) on delete cascade,
  foreign key (item_id, family_id) references public.items (id, family_id) on delete cascade
);
create index on public.meal_type_items (item_id, family_id);
create index on public.meal_type_items (meal_type_id, family_id);

create table public.planned_meals (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  date         date not null,
  meal_type_id uuid not null,
  dish_id      uuid,
  item_id      uuid,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (id, family_id),
  check ((dish_id is null) <> (item_id is null)),
  foreign key (meal_type_id, family_id) references public.meal_types (id, family_id) on delete cascade,
  foreign key (dish_id, family_id) references public.dishes (id, family_id) on delete cascade,
  foreign key (item_id, family_id) references public.items (id, family_id) on delete cascade
);
create index on public.planned_meals (family_id, date);
create index on public.planned_meals (dish_id, family_id);
create index on public.planned_meals (item_id, family_id);
create index on public.planned_meals (meal_type_id, family_id);
create index on public.planned_meals (created_by);

-- ---------------------------------------------------------------------------
-- Calendar & tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  title           text not null check (length(trim(title)) between 1 and 120),
  due_on          date,
  due_time        time,
  done_at         timestamptz,
  visibility      text not null default 'family' check (visibility in ('family', 'private')),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  planned_meal_id uuid,
  prep_step_id    uuid,
  created_at      timestamptz not null default now(),
  foreign key (planned_meal_id, family_id) references public.planned_meals (id, family_id) on delete cascade,
  foreign key (prep_step_id, family_id) references public.dish_prep_steps (id, family_id) on delete set null (prep_step_id)
);
create index on public.tasks (family_id, due_on);
create index on public.tasks (planned_meal_id, family_id);
create index on public.tasks (prep_step_id, family_id);
create index on public.tasks (owner_id);

-- ---------------------------------------------------------------------------
-- Shopping
-- ---------------------------------------------------------------------------
create table public.list_entries (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  item_id     uuid not null,
  amount_hint text not null default 'usual' check (amount_hint in ('usual', 'extra', 'a_bit')),
  amount      text check (length(amount) <= 40),
  store_id    uuid,
  status      text not null default 'to_buy' check (status in ('to_buy', 'in_bag', 'bought', 'removed')),
  added_by    uuid default auth.uid() references auth.users (id) on delete set null,
  added_at    timestamptz not null default now(),
  closed_at   timestamptz,
  unique (id, family_id),
  foreign key (item_id, family_id) references public.items (id, family_id) on delete cascade,
  foreign key (store_id, family_id) references public.stores (id, family_id) on delete set null (store_id)
);
-- One open row per item: a second reason joins the existing row.
create unique index list_entries_one_open on public.list_entries (item_id) where status in ('to_buy', 'in_bag');
create index on public.list_entries (family_id, status);
create index on public.list_entries (store_id, family_id);
create index on public.list_entries (item_id, family_id);
create index on public.list_entries (added_by);

create table public.list_entry_reasons (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null,
  family_id       uuid not null references public.families (id) on delete cascade,
  reason          text not null check (reason in ('planned_meal', 'restock_due', 'manual', 'dish')),
  planned_meal_id uuid,
  dish_id         uuid,
  created_at      timestamptz not null default now(),
  foreign key (entry_id, family_id) references public.list_entries (id, family_id) on delete cascade,
  foreign key (planned_meal_id, family_id) references public.planned_meals (id, family_id) on delete cascade,
  foreign key (dish_id, family_id) references public.dishes (id, family_id) on delete cascade
);
create index on public.list_entry_reasons (entry_id, family_id);
create index on public.list_entry_reasons (planned_meal_id, family_id);
create index on public.list_entry_reasons (dish_id, family_id);
create index on public.list_entry_reasons (family_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.families           enable row level security;
alter table public.family_members     enable row level security;
alter table public.categories         enable row level security;
alter table public.stores             enable row level security;
alter table public.catalog_items      enable row level security;
alter table public.starter_packs      enable row level security;
alter table public.starter_pack_items enable row level security;
alter table public.items              enable row level security;
alter table public.item_stores        enable row level security;
alter table public.item_events        enable row level security;
alter table public.meal_types         enable row level security;
alter table public.dishes             enable row level security;
alter table public.dish_meal_types    enable row level security;
alter table public.dish_ingredients   enable row level security;
alter table public.dish_prep_steps    enable row level security;
alter table public.meal_type_items    enable row level security;
alter table public.planned_meals      enable row level security;
alter table public.tasks              enable row level security;
alter table public.list_entries       enable row level security;
alter table public.list_entry_reasons enable row level security;

-- Families: members can read theirs; the owner can rename it.
create policy "members read their family" on public.families
  for select to authenticated using (id = (select public.my_family_id()));
create policy "owner updates family" on public.families
  for update to authenticated
  using (exists (select 1 from public.family_members m
                 where m.family_id = families.id and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (id = (select public.my_family_id()));

-- Members: see your family's members; change only your own display name.
-- Joining and leaving go through the functions below.
create policy "members read members" on public.family_members
  for select to authenticated using (family_id = (select public.my_family_id()));
create policy "members update own name" on public.family_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and family_id = (select public.my_family_id()));

-- Catalogue: anyone signed in can read it; nobody can change it from the app.
create policy "read catalogue" on public.catalog_items for select to authenticated using (true);
create policy "read starter packs" on public.starter_packs for select to authenticated using (true);
create policy "read starter pack items" on public.starter_pack_items for select to authenticated using (true);

-- Every family-owned table: full access to your own family's rows, nothing else.
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'stores', 'items', 'item_stores', 'item_events',
    'meal_types', 'dishes', 'dish_meal_types', 'dish_ingredients', 'dish_prep_steps',
    'meal_type_items', 'planned_meals', 'list_entries', 'list_entry_reasons'
  ] loop
    execute format(
      'create policy "family rows" on public.%I for all to authenticated
         using (family_id = (select public.my_family_id()))
         with check (family_id = (select public.my_family_id()))', t);
  end loop;
end $$;

-- Tasks: family tasks are shared; "just me" tasks only their owner sees.
create policy "family or own tasks" on public.tasks
  for all to authenticated
  using (family_id = (select public.my_family_id())
         and (visibility = 'family' or owner_id = (select auth.uid())))
  with check (family_id = (select public.my_family_id())
              and (visibility = 'family' or owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Commands that need to cross the family boundary safely
-- ---------------------------------------------------------------------------

-- Start a new family; the caller becomes its owner. Seeds the My Home root.
create function public.create_family(family_name text, my_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.family_members where user_id = uid) then
    raise exception 'You already belong to a family';
  end if;
  insert into public.families (name) values (trim(family_name)) returning id into fid;
  insert into public.family_members (user_id, family_id, role, display_name)
    values (uid, fid, 'owner', trim(coalesce(my_name, '')));
  insert into public.categories (family_id, name, sort) values (fid, 'My Home', 0);
  return fid;
end $$;

-- Join a family with its invite code.
create function public.join_family(code text, my_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.family_members where user_id = uid) then
    raise exception 'You already belong to a family';
  end if;
  select id into fid from public.families where invite_code = upper(trim(code));
  if fid is null then raise exception 'That invite code was not found'; end if;
  insert into public.family_members (user_id, family_id, role, display_name)
    values (uid, fid, 'member', trim(coalesce(my_name, '')));
  return fid;
end $$;

-- Owner can issue a fresh invite code (old one stops working).
create function public.new_invite_code()
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  fid uuid;
  code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  select family_id into fid from public.family_members
    where user_id = auth.uid() and role = 'owner';
  if fid is null then raise exception 'Only the family owner can do that'; end if;
  update public.families set invite_code = code where id = fid;
  return code;
end $$;

-- Search the catalogue by name or other names, best matches first.
create function public.search_catalog(q text, max_results int default 20)
returns setof public.catalog_items
language sql stable
set search_path = ''
as $$
  select c.* from public.catalog_items c
  where c.search_text operator(extensions.%) lower(q)
     or c.search_text like '%' || lower(q) || '%'
  order by (c.search_text like lower(q) || '%') desc,
           extensions.word_similarity(lower(q), c.search_text) desc,
           length(c.name)
  limit least(max_results, 50)
$$;

revoke all on function public.create_family(text, text) from public, anon;
revoke all on function public.join_family(text, text) from public, anon;
revoke all on function public.new_invite_code() from public, anon;
revoke all on function public.my_family_id() from public, anon;
revoke all on function public.search_catalog(text, int) from public, anon;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.new_invite_code() to authenticated;
grant execute on function public.my_family_id() to authenticated;
grant execute on function public.search_catalog(text, int) to authenticated;

-- Keep items.updated_at current.
create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- Live sync between family members' phones.
alter publication supabase_realtime add table
  public.items, public.list_entries, public.list_entry_reasons,
  public.planned_meals, public.tasks, public.categories;
