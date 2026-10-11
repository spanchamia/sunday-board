-- Move the policy helper out of the public API (Supabase security advisor), and add
-- covering indexes the performance advisor asked for. Policies keep working: they
-- reference the function itself, not its schema-qualified name.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
alter function public.my_family_id() set schema private;

create index on public.categories (parent_id, family_id);
create index on public.dish_ingredients (family_id);
create index on public.dish_meal_types (family_id);
create index on public.dish_prep_steps (family_id);
create index on public.item_stores (family_id);
create index on public.items (category_id, family_id);
create index on public.meal_type_items (family_id);
create index on public.starter_pack_items (catalog_item_id);
