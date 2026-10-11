import { supabase } from '../lib/supabase';
import type { ListEntry } from '../lib/types';

export type Reason =
  | { kind: 'manual' }
  | { kind: 'dish'; dishId: string }
  | { kind: 'planned_meal'; plannedMealId: string };

const OPEN = ['to_buy', 'in_bag'];

/**
 * Put an item on the shopping list with a reason. If it's already on the list, the
 * reason is added to the same row (one row per item). Returns whether it was new.
 */
export async function addToList(familyId: string, itemId: string, reason: Reason): Promise<'added' | 'already'> {
  let status: 'added' | 'already' = 'already';
  const found = await supabase.from('list_entries').select('id').eq('item_id', itemId).in('status', OPEN).maybeSingle();
  if (found.error) throw found.error;
  let entryId = found.data?.id;
  if (!entryId) {
    const ins = await supabase.from('list_entries').insert({ family_id: familyId, item_id: itemId }).select('id').single();
    if (ins.error) {
      // Another phone added it at the same moment: use that row.
      const again = await supabase.from('list_entries').select('id').eq('item_id', itemId).in('status', OPEN).maybeSingle();
      if (again.error || !again.data) throw ins.error;
      entryId = again.data.id;
    } else {
      entryId = ins.data.id;
      status = 'added';
    }
  }
  const r = await supabase.from('list_entry_reasons').insert({
    entry_id: entryId, family_id: familyId,
    reason: reason.kind,
    dish_id: reason.kind === 'dish' ? reason.dishId : null,
    planned_meal_id: reason.kind === 'planned_meal' ? reason.plannedMealId : null,
  });
  if (r.error) throw r.error;
  return status;
}

/** Bought: closes the row and records the purchase (which teaches restock timing). */
export async function markBought(familyId: string, entry: ListEntry): Promise<void> {
  const u = await supabase.from('list_entries').update({ status: 'bought', closed_at: new Date().toISOString() }).eq('id', entry.id);
  if (u.error) throw u.error;
  const e = await supabase.from('item_events').insert({ family_id: familyId, item_id: entry.item_id, kind: 'bought', store_id: entry.store_id });
  if (e.error) throw e.error;
}

/** Undo "bought" right after tapping it by mistake. */
export async function undoBought(entry: ListEntry): Promise<void> {
  const u = await supabase.from('list_entries').update({ status: 'to_buy', closed_at: null }).eq('id', entry.id);
  if (u.error) throw u.error;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const d = await supabase.from('item_events').delete().eq('item_id', entry.item_id).eq('kind', 'bought').eq('happened_on', iso);
  if (d.error) throw d.error;
}

/** Take a row off the list without recording a purchase. */
export async function removeFromList(entryId: string): Promise<void> {
  const u = await supabase.from('list_entries').update({ status: 'removed', closed_at: new Date().toISOString() }).eq('id', entryId);
  if (u.error) throw u.error;
}
