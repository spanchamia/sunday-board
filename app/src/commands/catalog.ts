import { inheritedRestockMode } from '../logic/tree';
import { supabase } from '../lib/supabase';
import type { CatalogItem, Category, Item, RestockMode, StarterPack } from '../lib/types';
import { norm } from '../logic/text';
import { ensureCategoryPath } from './categories';
import { addItem } from './items';

export async function searchCatalog(q: string, max = 12): Promise<CatalogItem[]> {
  if (q.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('search_catalog', { q: q.trim(), max_results: max });
  if (error) throw error;
  return data ?? [];
}

export async function listStarterPacks(): Promise<StarterPack[]> {
  const { data, error } = await supabase.from('starter_packs').select('*').order('sort');
  if (error) throw error;
  return data ?? [];
}

export async function starterPackItems(packId: string): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from('starter_pack_items')
    .select('catalog_items(*)')
    .eq('pack_id', packId);
  if (error) throw error;
  return (data ?? []).flatMap((r) => (r as unknown as { catalog_items: CatalogItem | null }).catalog_items ?? []);
}

export interface FamilyContext {
  familyId: string;
  homeId: string;
  categories: Category[]; // updated in place as categories get created
}

/** Add a catalogue product to My Home, filed under its suggested category. */
export async function addFromCatalog(ctx: FamilyContext, c: CatalogItem): Promise<Item> {
  const mode = (c.restock_mode === 'staple' ? 'staple' : 'as_needed') as RestockMode;
  const categoryId = await ensureCategoryPath(ctx.familyId, ctx.categories, ctx.homeId, c.category_path);
  // Follow the category when it agrees; keep the catalogue's setting as an exception
  // when it differs, or when the category doesn't say.
  const own = inheritedRestockMode(ctx.categories, categoryId) === mode ? null : mode;
  return addItem({ familyId: ctx.familyId, name: c.name, categoryId, restockMode: own, catalogItemId: c.id });
}

/** Add several catalogue products, skipping any the family already has (by name). */
export async function addManyFromCatalog(ctx: FamilyContext, products: readonly CatalogItem[], existing: readonly Item[]): Promise<{ added: number; skipped: number }> {
  const have = new Set(existing.filter((i) => !i.archived_at).map((i) => norm(i.name)));
  let added = 0;
  let skipped = 0;
  for (const p of products) {
    if (have.has(norm(p.name))) { skipped++; continue; }
    await addFromCatalog(ctx, p);
    have.add(norm(p.name));
    added++;
  }
  return { added, skipped };
}
