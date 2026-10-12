import { supabase } from '../lib/supabase';
import type { Item, RestockMode } from '../lib/types';
import { cleanName } from '../logic/text';

export interface NewItem {
  familyId: string;
  name: string;
  categoryId: string | null;
  restockMode: RestockMode | null;   // null = same as its category
  catalogItemId?: string | null;
  restockEveryDays?: number | null;
  usualAmount?: string | null;
}

export async function addItem(n: NewItem): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      family_id: n.familyId,
      name: cleanName(n.name),
      category_id: n.categoryId,
      restock_mode: n.restockMode,
      catalog_item_id: n.catalogItemId ?? null,
      restock_every_days: n.restockEveryDays ?? null,
      usual_amount: n.usualAmount?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type ItemPatch = Partial<Pick<Item, 'name' | 'category_id' | 'restock_mode' | 'restock_every_days' | 'usual_amount' | 'notes'>>;

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  const clean = { ...patch, ...(patch.name ? { name: cleanName(patch.name) } : {}) };
  const { error } = await supabase.from('items').update(clean).eq('id', id);
  if (error) throw error;
}

/** Hide an item from My Home but keep its history (purchases, dishes that used it). */
export async function archiveItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Replace the set of stores that carry an item. */
export async function setItemStores(familyId: string, itemId: string, storeIds: readonly string[]): Promise<void> {
  const del = await supabase.from('item_stores').delete().eq('item_id', itemId);
  if (del.error) throw del.error;
  if (!storeIds.length) return;
  const { error } = await supabase
    .from('item_stores')
    .insert(storeIds.map((store_id) => ({ family_id: familyId, item_id: itemId, store_id })));
  if (error) throw error;
}

/** Let these items follow their category again (clears their own staple / as-needed setting). */
export async function followCategory(itemIds: readonly string[]): Promise<void> {
  for (let i = 0; i < itemIds.length; i += 100) {
    const u = await supabase.from('items').update({ restock_mode: null }).in('id', itemIds.slice(i, i + 100));
    if (u.error) throw u.error;
  }
}
