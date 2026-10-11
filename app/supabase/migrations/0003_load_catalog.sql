-- Load the shared catalogue and starter sets from the repo, pinned to the commit that
-- built them (app/supabase/seed/build_catalog.py). The http extension is enabled only
-- for this load and removed again, so the database can't make web requests afterwards.
create extension if not exists http with schema extensions;

do $$
declare
  base text := 'https://raw.githubusercontent.com/spanchamia/sunday-board/3501ad3b31f0c9ccc15b84c54189432fb1c3c4f7/app/supabase/seed/';
  cat jsonb;
  packs jsonb;
  r extensions.http_response;
begin
  select * into r from extensions.http_get(base || 'catalog.json');
  if r.status <> 200 then raise exception 'catalog.json: HTTP %', r.status; end if;
  cat := r.content::jsonb;

  select * into r from extensions.http_get(base || 'starter_packs.json');
  if r.status <> 200 then raise exception 'starter_packs.json: HTTP %', r.status; end if;
  packs := r.content::jsonb;

  insert into public.catalog_items (name, aliases, category_path, restock_mode, tags, sizes, search_text)
  select e->>'name',
         array(select jsonb_array_elements_text(e->'aliases')),
         array(select jsonb_array_elements_text(e->'category_path')),
         e->>'restock_mode',
         array(select jsonb_array_elements_text(e->'tags')),
         array(select jsonb_array_elements_text(e->'sizes')),
         e->>'search_text'
  from jsonb_array_elements(cat) e
  on conflict (name) do update set
    aliases = excluded.aliases, category_path = excluded.category_path, restock_mode = excluded.restock_mode,
    tags = excluded.tags, sizes = excluded.sizes, search_text = excluded.search_text;

  insert into public.starter_packs (id, name, description, sort)
  select p->>'id', p->>'name', p->>'description', (p->>'sort')::int from jsonb_array_elements(packs) p
  on conflict (id) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;

  delete from public.starter_pack_items;
  insert into public.starter_pack_items (pack_id, catalog_item_id)
  select p->>'id', c.id
  from jsonb_array_elements(packs) p
  cross join jsonb_array_elements_text(p->'items') n
  join public.catalog_items c on c.name = n
  on conflict do nothing;
end $$;

drop extension http;
